"use client";

// WhatsApp do CRM (Atendimento) — três colunas: conversas | chat | contexto do
// cliente com o Orientador de Vendas. Visual no padrão do CRM (grafite +
// amarelo), sem imitar o WhatsApp Web. A tela ocupa a área útil inteira com
// posicionamento fixo (nada de margens negativas), então nunca "desenquadra".

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Send, ArrowLeft, Check, CheckCheck, User, MoreVertical, MessageCircle, Users,
  DownloadCloud, Loader2, Brain, Trash2, X, FileText, Handshake, Link2, ListChecks,
  CheckCircle2, Compass, Flame, ThermometerSun, Snowflake, Calendar, Repeat,
  ChevronUp, PanelRightOpen, Sparkles, AlertTriangle, MapPin, Wallet, Bell,
  Paperclip, Mic, Square, Zap, RefreshCw, FileDown, Plus,
} from "lucide-react";
import { unzipSync, strFromU8 } from "fflate";
import { parseWhatsAppLines, montarChat, nomeDoArquivo, type ParsedChat } from "@/lib/whatsapp-export-parser";
import {
  contextoConversaAction, marcarRespondidoAction, resolverAlertaConversaAction, registrarUsoRespostaAction,
  listarRespostasProntasAction, salvarRespostaProntaAction, excluirRespostaProntaAction, reanalisarConversaAction,
  salvarNotaOrientadorAction,
  type ContextoConversa, type RespostaPronta,
} from "@/lib/atendimento-actions";
import { cn, formatCurrency } from "@/lib/utils";
import { maquinaDaNegociacao, pagamentoDaNegociacao, assuntoDaUltimaConversa } from "@/lib/negociacao-verificada";

export type ConvLista = {
  id: string;
  externalPhone: string;
  contactName: string | null;
  isGroup: boolean;
  groupName: string | null;
  encerrada: boolean;
  aiActive: boolean;
  category: string | null;
  contactPhotoUrl: string | null;
  clienteId: string | null;
  // Nome do cliente no CRM. É o nome da SUA agenda: o Google Contatos traz a
  // lista de contatos do celular para cá. Tem prioridade sobre o nome que vem
  // do WhatsApp, que é o que o próprio contato escolheu no perfil dele.
  nomeCliente: string | null;
  lastMessageAt: string;
  naoLida: boolean;
  previa: string;
  temRascunho: boolean;
  aguardando: boolean;
};

type Mensagem = {
  id: string;
  direction: "IN" | "OUT";
  body: string;
  senderName: string | null;
  operatorDisplayName: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  mediaName?: string | null;
  sentAt: string;
  sendStatus: string | null;
  isDraft: boolean;
};

type Conexao = { configurado: boolean; conectado: boolean; provedor: "evolution" | "zapi" | null };
type Filtro = "todas" | "nao_lidas" | "aguardando" | "rascunho" | "sem_vinculo";

// Chips visíveis na barra de filtros — só os dois pedidos pelo Edy. Os demais
// valores de Filtro continuam existindo (setFiltro("nao_lidas") no badge de
// não lidas, por exemplo), só não ganham botão aqui.
const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "nao_lidas", label: "Não lidas" },
];

function iniciais(s: string) {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}
function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}
function quandoCurto(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return hora(iso);
  const diff = (hoje.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}
function diaChave(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
}
// Ordem de quem manda no nome:
//   1. o cliente cadastrado no CRM — que é a SUA agenda, trazida do celular
//      pelo Google Contatos. É este o nome que você escreveu.
//   2. o nome que veio do WhatsApp (perfil do contato) — só quando não tem
//      cliente vinculado, senão o apelido que ele pôs no WhatsApp dele
//      apareceria no lugar do nome que você deu.
//   3. o número.
function nomeConv(
  c: { contactName: string | null; groupName: string | null; isGroup: boolean; externalPhone: string; nomeCliente?: string | null },
  overlayName?: string | null,
) {
  if (c.isGroup) return c.groupName || c.contactName || c.externalPhone;
  return c.nomeCliente || overlayName || c.contactName || c.externalPhone;
}
function telefoneBonito(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return p;
}

function Avatar({ nome, isGroup, photo, size }: { nome: string; isGroup: boolean; photo: string | null; size: number }) {
  const [erro, setErro] = useState(false);
  if (photo && !erro) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="" onError={() => setErro(true)} referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    );
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", isGroup ? "bg-brand-700 text-brand-200" : "bg-agro-400/20 text-agro-300 ring-1 ring-agro-400/30")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
      {isGroup ? <Users size={Math.round(size * 0.45)} /> : iniciais(nome)}
    </div>
  );
}

function Temperatura({ t }: { t: string }) {
  if (t === "muito_quente" || t === "quente") return <span className="inline-flex items-center gap-1 text-orange-300"><Flame size={13} /> {t === "muito_quente" ? "Muito quente" : "Quente"}</span>;
  if (t === "fria") return <span className="inline-flex items-center gap-1 text-sky-300"><Snowflake size={13} /> Fria</span>;
  return <span className="inline-flex items-center gap-1 text-amber-300"><ThermometerSun size={13} /> Morna</span>;
}

/**
 * Uma linha do card "Negociação": máquina, valor ou pagamento. Confirmado sai
 * com o ✓ verde e nada mais — só o símbolo, sem a palavra na frente. O que
 * ainda falta fica apagado, dizendo o que falta.
 */
function ItemVerificado({ rotulo, valor, falta }: { rotulo: string; valor: string | null; falta: string }) {
  if (!valor) {
    return (
      <div className="flex gap-1.5 text-brand-500">
        <span className="w-3 shrink-0 text-center">○</span>
        <span>{rotulo}: {falta}</span>
      </div>
    );
  }
  return (
    <div className="flex gap-1.5 text-emerald-200">
      <span className="w-3 shrink-0 text-center font-bold text-emerald-400" title="Confirmado">✓</span>
      <span>{rotulo}: <b className="text-white">{valor}</b></span>
    </div>
  );
}

type Anexo = { kind: "image" | "audio" | "document"; base64: string; mimeType: string; fileName: string; preview: string | null; thumb: string | null; tamanho: number };

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).replace(/^data:[^;]+;base64,/, ""));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

// Reduz a foto no navegador (máx. 1600px, JPEG) para caber no limite de envio
// e gera uma miniatura (480px) que fica guardada na mensagem enviada.
async function prepararImagem(file: File): Promise<{ base64: string; thumb: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const desenhar = (max: number, q: number) => {
    const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * escala);
    c.height = Math.round(bitmap.height * escala);
    c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  };
  const grande = desenhar(1600, 0.82);
  const thumb = desenhar(480, 0.7);
  return { base64: grande.replace(/^data:[^;]+;base64,/, ""), thumb, mimeType: "image/jpeg" };
}

// {nome}: primeiro nome da pessoa; nome inteiro quando o contato é uma
// empresa (Construtora X, Pedreira Y, Prefeitura...) ou está vazio.
function aplicarPlaceholders(texto: string, nomeContato: string, vendedor: string): string {
  const limpo = nomeContato.trim();
  const empresa = /construtora|pedreira|prefeitura|ltda|s\.?a\.?$|locadora|terraplen|mineradora|engenharia|empreiteira|fazenda|transportes|comércio|comercio|indústria|industria/i.test(limpo);
  const nome = empresa ? limpo : (limpo.split(/\s+/)[0] ?? limpo);
  return texto
    .replace(/\{nome\},?\s*/g, nome ? `${nome}, ` : "")
    .replace(/\{vendedor\}/g, vendedor)
    .replace(/^\s*,\s*/, "")
    .replace(/^([a-zà-ú])/, (m) => m.toUpperCase());
}

const botaoIcone = "flex h-9 w-9 items-center justify-center rounded-lg text-brand-300 hover:bg-white/10 hover:text-white transition";
const chip = (ativo: boolean) => cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition", ativo ? "bg-agro-400 text-black" : "bg-white/5 text-brand-300 hover:bg-white/10");

export function AtendimentoClient({ conversas, conexao, convInicial, vendedorNome = "" }: {
  conversas: ConvLista[];
  conexao: Conexao;
  convInicial?: string | null;
  vendedorNome?: string;
}) {
  const router = useRouter();
  const [selId, setSelIdRaw] = useState<string | null>(convInicial ?? null);
  const [lidas, setLidas] = useState<Set<string>>(() => new Set(convInicial ? [convInicial] : []));
  // Abrir a conversa marca como lida na hora (a bolinha some), sem esperar a
  // lista recarregar do servidor.
  const setSelId = useCallback((id: string | null) => {
    setSelIdRaw(id);
    if (id) setLidas((l) => (l.has(id) ? l : new Set(l).add(id)));
  }, []);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [buscaMsg, setBuscaMsg] = useState<string | null>(null);
  const [resultadosBusca, setResultadosBusca] = useState<Mensagem[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [sincNomes, setSincNomes] = useState(false);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [excluindoSelecao, setExcluindoSelecao] = useState(false);
  const [flags, setFlags] = useState<Record<string, Partial<{ aiActive: boolean; contactName: string; clienteId: string | null }>>>({});
  const [menuAberto, setMenuAberto] = useState(false);
  const [vincularConv, setVincularConv] = useState<ConvLista | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [contexto, setContexto] = useState<ContextoConversa | null>(null);
  const [carregandoContexto, setCarregandoContexto] = useState(false);
  const [topo, setTopo] = useState(0);
  const [anexo, setAnexo] = useState<Anexo | null>(null);
  const [legenda, setLegenda] = useState("");
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [respostasAbertas, setRespostasAbertas] = useState(false);
  const [respostas, setRespostas] = useState<RespostaPronta[] | null>(null);
  const [reanalisando, setReanalisando] = useState(false);
  const [avisoPainel, setAvisoPainel] = useState<string | null>(null);
  // "O que você sabe": o que o vendedor digita para o Orientador levar em conta.
  const [nota, setNota] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [notaAviso, setNotaAviso] = useState<string | null>(null);
  // De qual conversa a nota da caixa já foi carregada — sem isto, o contexto
  // recarregando no meio da digitação apagaria o que está sendo escrito.
  const notaCarregadaDe = useRef<string | null>(null);
  const anexoRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoScrollRef = useRef(true);
  const prevSelIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // A tela é fixa: no celular começa logo abaixo da barra do CRM (altura real,
  // medida — muda com a safe-area do iPhone); no desktop começa no topo.
  useEffect(() => {
    const medir = () => {
      const barra = document.getElementById("topbar-mobile");
      const visivel = barra && window.getComputedStyle(barra).display !== "none";
      setTopo(visivel ? barra.getBoundingClientRect().height : 0);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const curr = useCallback((c: ConvLista) => ({ ...c, ...(flags[c.id] ?? {}), naoLida: c.naoLida && !lidas.has(c.id) }), [flags, lidas]);

  async function patchConv(c: ConvLista, patch: Partial<{ aiActive: boolean; contactName: string; clienteId: string | null }>) {
    setFlags((f) => ({ ...f, [c.id]: { ...(f[c.id] ?? {}), ...patch } }));
    try {
      await fetch(`/api/conversations/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    } catch {}
    router.refresh();
  }

  async function excluirConversa(c: ConvLista) {
    const nome = nomeConv(c, curr(c).contactName);
    if (!window.confirm(`Excluir a conversa com "${nome}"? Todas as mensagens serão apagadas do CRM.`)) return;
    setMenuAberto(false);
    const r = await fetch(`/api/conversations/${c.id}`, { method: "DELETE" }).then((res) => res.json()).catch(() => null);
    if (!r?.ok) { window.alert("Não foi possível excluir a conversa."); return; }
    if (selId === c.id) { setSelId(null); setMensagens([]); }
    router.refresh();
  }

  function alternarSelecao(id: string) {
    setSelecionadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function excluirSelecionadas() {
    if (!selecionadas.size || excluindoSelecao) return;
    if (!window.confirm(`Excluir ${selecionadas.size} conversa(s) selecionada(s)? Todas as mensagens serão apagadas do CRM.`)) return;
    setExcluindoSelecao(true);
    const ids = Array.from(selecionadas);
    await Promise.all(ids.map((id) => fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => null)));
    setExcluindoSelecao(false);
    if (selId && ids.includes(selId)) { setSelId(null); setMensagens([]); }
    setSelecionadas(new Set());
    setModoSelecao(false);
    router.refresh();
  }

  async function draftAction(messageId: string, action: "send" | "discard", body?: string) {
    if (!selId) return;
    const r = await fetch(`/api/conversations/${selId}/drafts`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, action, body }),
    }).then((res) => res.json()).catch(() => null);
    if (!r?.ok) { if (action === "send") window.alert(r?.erro ?? "Não foi possível enviar."); return; }
    if (action === "discard") setMensagens((p) => p.filter((m) => m.id !== messageId));
    else if (r.message) setMensagens((p) => p.map((m) => (m.id === messageId ? r.message : m)));
    router.refresh();
  }

  function editarDraft(m: Mensagem) {
    setTexto(m.body);
    draftAction(m.id, "discard");
    textareaRef.current?.focus();
  }

  function usarResposta(textoResposta: string) {
    setTexto(textoResposta);
    textareaRef.current?.focus();
    if (selId) registrarUsoRespostaAction(selId).catch(() => {});
  }

  async function escolherAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.type.startsWith("image/")) {
        const img = await prepararImagem(file);
        setAnexo({ kind: "image", base64: img.base64, mimeType: img.mimeType, fileName: file.name, preview: img.thumb, thumb: img.thumb, tamanho: Math.round(img.base64.length * 0.75) });
      } else {
        if (file.size > 3 * 1024 * 1024) { window.alert("Arquivo acima de 3 MB. Reduza o tamanho antes de enviar."); return; }
        setAnexo({ kind: "document", base64: await blobParaBase64(file), mimeType: file.type || "application/octet-stream", fileName: file.name, preview: null, thumb: null, tamanho: file.size });
      }
      setLegenda("");
    } catch (err) {
      console.error(err);
      window.alert("Não foi possível ler o arquivo.");
    }
  }

  async function iniciarGravacao() {
    if (gravando) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        if (blob.size < 1000) return;
        const base64 = await blobParaBase64(blob);
        const tipo = (blob.type || "audio/webm").split(";")[0];
        setAnexo({ kind: "audio", base64, mimeType: tipo, fileName: "audio", preview: URL.createObjectURL(blob), thumb: null, tamanho: blob.size });
      };
      rec.start();
      recorderRef.current = rec;
      setGravando(true);
      setSegundos(0);
      timerRef.current = setInterval(() => setSegundos((v) => v + 1), 1000);
    } catch {
      window.alert("Sem acesso ao microfone. Libere a permissão no navegador.");
    }
  }

  function pararGravacao() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setGravando(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function enviarAnexo() {
    if (!anexo || !selId || enviandoAnexo) return;
    setEnviandoAnexo(true);
    autoScrollRef.current = true;
    try {
      const r = await fetch(`/api/conversations/${selId}/media`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: anexo.kind, base64: anexo.base64, mimeType: anexo.mimeType, fileName: anexo.fileName, caption: legenda.trim(), thumb: anexo.thumb }),
      }).then((res) => res.json()).catch(() => null);
      if (!r?.ok) { window.alert(r?.erro ?? "Não foi possível enviar."); return; }
      if (r.message) mergeMsgs([r.message]);
      setAnexo(null); setLegenda("");
      router.refresh();
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function abrirRespostas() {
    setRespostasAbertas(true);
    if (!respostas) setRespostas(await listarRespostasProntasAction().catch(() => []));
  }

  function aplicarRespostaPronta(r: RespostaPronta) {
    if (!sel) return;
    const nome = nomeConv(sel, selAtual?.contactName);
    setTexto(aplicarPlaceholders(r.texto, /^\+?\d[\d\s()-]+$/.test(nome) ? "" : nome, vendedorNome).replace(/^,\s*/, "").replace(/^\s*,/, ""));
    setRespostasAbertas(false);
    textareaRef.current?.focus();
  }

  async function reanalisar() {
    if (!selId || reanalisando) return;
    setReanalisando(true); setAvisoPainel(null);
    const r = await reanalisarConversaAction(selId).catch(() => ({ ok: false, erro: "Falha ao reanalisar." }));
    if (!r.ok) setAvisoPainel(r.erro ?? "Falha ao reanalisar.");
    notaCarregadaDe.current = null; // deixa a caixa recarregar do que foi salvo
    await carregarContexto(selId);
    setReanalisando(false);
  }

  // Salva o que o vendedor escreveu e já manda o Orientador reanalisar com
  // aquilo — é isso que ele quer quando digita: ver a leitura mudar.
  async function salvarNotaEReanalisar() {
    if (!selId || salvandoNota) return;
    setSalvandoNota(true); setNotaAviso(null); setAvisoPainel(null);
    try {
      const s = await salvarNotaOrientadorAction(selId, nota);
      if (!s.ok) { setNotaAviso(s.erro ?? "Não deu para salvar."); return; }
      setNotaAviso("Guardado. Reanalisando com essa informação…");
      const r = await reanalisarConversaAction(selId).catch(() => ({ ok: false, erro: "Falha ao reanalisar." }));
      if (!r.ok) setNotaAviso(r.erro ?? "Guardado, mas a reanálise falhou.");
      else setNotaAviso("Pronto — a leitura abaixo já considera o que você escreveu.");
      notaCarregadaDe.current = null;
      await carregarContexto(selId);
    } catch {
      setNotaAviso("Não deu para falar com o servidor.");
    } finally {
      setSalvandoNota(false);
      setTimeout(() => setNotaAviso(null), 8000);
    }
  }

  function htmlParaTexto(html: string): string {
    const comQuebras = html.replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n");
    const doc = new DOMParser().parseFromString(comQuebras, "text/html");
    return doc.body?.textContent ?? "";
  }

  async function arquivosEscolhidos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setImportando(true);
    setImportMsg("Lendo arquivos…");
    const porNome = new Map<string, ParsedChat>();
    try {
      for (const file of files) {
        const baseZip = nomeDoArquivo(file.name);
        let textos: Array<{ path: string; texto: string }> = [];
        if (/\.zip$/i.test(file.name)) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const entradas = unzipSync(bytes, { filter: (f) => /\.(txt|html?)$/i.test(f.name) });
          textos = Object.entries(entradas).map(([path, data]) => {
            const cru = strFromU8(data);
            return { path, texto: /\.html?$/i.test(path) ? htmlParaTexto(cru) : cru };
          });
        } else if (/\.html?$/i.test(file.name)) {
          textos = [{ path: file.name, texto: htmlParaTexto(await file.text()) }];
        } else if (/\.txt$/i.test(file.name)) {
          textos = [{ path: file.name, texto: await file.text() }];
        }
        for (const { path, texto: t } of textos) {
          const raw = parseWhatsAppLines(t);
          if (!raw.length) continue;
          let nome = nomeDoArquivo(path);
          if (!nome || /^_chat$/i.test(nome)) nome = baseZip;
          const chat = montarChat(nome, raw);
          const ja = porNome.get(nome.toLowerCase());
          if (ja) ja.messages.push(...chat.messages);
          else porNome.set(nome.toLowerCase(), chat);
        }
      }
      const chats = Array.from(porNome.values()).filter((c) => c.messages.length);
      if (!chats.length) { setImportMsg("Nenhuma mensagem reconhecida."); return; }
      let convOk = 0, msgsOk = 0, i = 0;
      for (const chat of chats) {
        i++;
        setImportMsg(`Importando ${i}/${chats.length}…`);
        const r = await fetch("/api/whatsapp/import-file", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chats: [chat] }),
        }).then((res) => res.json()).catch(() => null);
        if (r?.ok) { convOk += r.conversas; msgsOk += r.mensagens; }
      }
      setImportMsg(`${convOk} conversa(s), ${msgsOk} mensagem(ns) importadas`);
    } catch (err) {
      console.error(err);
      setImportMsg("Falha ao ler os arquivos.");
    } finally {
      setImportando(false);
      setTimeout(() => setImportMsg(null), 6000);
      router.refresh();
    }
  }

  // Puxa do celular o nome dos contatos como estão na SUA agenda. O nome que
  // vem junto da mensagem é o que o contato escolheu no WhatsApp dele, então
  // renomear na agenda não chega por ali — tem que vir da lista de conversas.
  async function atualizarNomesDaAgenda() {
    if (sincNomes) return;
    setSincNomes(true);
    setImportMsg("Buscando os nomes no seu celular…");
    try {
      const r = await fetch("/api/whatsapp/sincronizar-nomes", { method: "POST" }).then((x) => x.json());
      if (r?.erro) setImportMsg(`Não deu para atualizar: ${r.erro}`);
      else if (r?.nomesAtualizados > 0) setImportMsg(`${r.nomesAtualizados} nome(s) atualizado(s).`);
      else setImportMsg(`Nenhum nome mudou (${r?.contatosLidos ?? 0} contato(s) conferido(s)).`);
    } catch (err) {
      console.error(err);
      setImportMsg("Não deu para falar com o servidor.");
    } finally {
      setSincNomes(false);
      setTimeout(() => setImportMsg(null), 8000);
      router.refresh();
    }
  }

  // Lista atualiza a cada 30s; as mensagens da conversa aberta chegam por SSE.
  useEffect(() => {
    const iv = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(iv);
  }, [router]);

  const sel = useMemo(() => conversas.find((c) => c.id === selId) ?? null, [conversas, selId]);
  const selAtual = sel ? curr(sel) : null;

  const carregarContexto = useCallback(async (id: string) => {
    setCarregandoContexto(true);
    try { setContexto(await contextoConversaAction(id)); } catch { setContexto(null); } finally { setCarregandoContexto(false); }
  }, []);

  // Trocou de conversa: esvazia a caixa e marca para recarregar.
  useEffect(() => {
    notaCarregadaDe.current = null;
    setNota("");
    setNotaAviso(null);
  }, [selId]);

  // Chegou o contexto daquela conversa: preenche a caixa com o que está
  // salvo — uma vez só, para não atropelar quem está digitando.
  useEffect(() => {
    if (!contexto || !selId || notaCarregadaDe.current === selId) return;
    notaCarregadaDe.current = selId;
    setNota(contexto.orientador?.notaVendedor ?? "");
  }, [contexto, selId]);

  const mergeMsgs = useCallback((novas: Mensagem[]) => {
    setMensagens((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const add = novas.filter((m) => !ids.has(m.id));
      if (!add.length) return prev;
      return [...prev, ...add].sort((a, b) => +new Date(a.sentAt) - +new Date(b.sentAt));
    });
    // Mensagem nova do cliente ou rascunho novo: o Orientador pode ter reanalisado.
    if (selId && novas.some((m) => m.direction === "IN" || m.isDraft)) setTimeout(() => carregarContexto(selId), 4000);
  }, [selId, carregarContexto]);

  useEffect(() => {
    esRef.current?.close();
    setBuscaMsg(null); setResultadosBusca(null); setMenuAberto(false);
    if (!selId) { setMensagens([]); setContexto(null); return; }
    let vivo = true;
    carregarContexto(selId);
    fetch(`/api/conversations/${selId}/messages`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        setMensagens(d.messages ?? []);
        setTemMais(!!d.temMais);
        // O GET acima gravou lastAccessedAt no servidor; recarrega a lista
        // para o estado persistido bater com o local.
        setTimeout(() => router.refresh(), 500);
        const ultimo = d.messages?.[d.messages.length - 1]?.id ?? "";
        const es = new EventSource(`/api/conversations/${selId}/stream${ultimo ? `?after=${ultimo}` : ""}`);
        es.addEventListener("messages", (e) => { try { mergeMsgs(JSON.parse((e as MessageEvent).data)); } catch {} });
        esRef.current = es;
      })
      .catch(() => {});
    return () => { vivo = false; esRef.current?.close(); };
  }, [selId, mergeMsgs, carregarContexto, router]);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const trocou = prevSelIdRef.current !== selId;
    prevSelIdRef.current = selId;
    if (trocou || autoScrollRef.current) el.scrollTop = el.scrollHeight;
  }, [selId, mensagens.length]);

  async function carregarAnteriores() {
    if (!selId || !mensagens.length || carregandoMais) return;
    setCarregandoMais(true);
    const el = chatRef.current;
    const alturaAntes = el?.scrollHeight ?? 0;
    try {
      const d = await fetch(`/api/conversations/${selId}/messages?before=${mensagens[0].id}`).then((r) => r.json());
      const antigas: Mensagem[] = d.messages ?? [];
      setTemMais(!!d.temMais);
      if (antigas.length) {
        autoScrollRef.current = false;
        setMensagens((p) => [...antigas, ...p]);
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - alturaAntes; });
      }
    } catch {} finally { setCarregandoMais(false); }
  }

  async function buscarNasMensagens(q: string) {
    setBuscaMsg(q);
    if (!selId || !q.trim()) { setResultadosBusca(null); return; }
    const d = await fetch(`/api/conversations/${selId}/messages?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).catch(() => null);
    setResultadosBusca(d?.messages ?? []);
  }

  async function enviar() {
    const t = texto.trim();
    if (!t || !selId) return;
    setTexto("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setEnviando(true);
    autoScrollRef.current = true;
    const temp: Mensagem = { id: `tmp-${Date.now()}`, direction: "OUT", body: t, senderName: null, operatorDisplayName: "Você", mediaType: null, mediaUrl: null, sentAt: new Date().toISOString(), sendStatus: "QUEUED", isDraft: false };
    setMensagens((p) => [...p, temp]);
    try {
      const r = await fetch(`/api/conversations/${selId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t }) });
      const d = await r.json();
      if (d?.message) setMensagens((p) => p.map((m) => (m.id === temp.id ? d.message : m)));
      if (d?.ok) marcarRespondidoAction(selId).catch(() => {});
    } catch {
      setMensagens((p) => p.map((m) => (m.id === temp.id ? { ...m, sendStatus: "FAILED" } : m)));
    } finally {
      setEnviando(false);
    }
  }

  const naoLidas = conversas.filter((c) => curr(c).naoLida).length;
  const filtradas = conversas
    .map(curr)
    .filter((c) => {
      if (filtro === "nao_lidas") return c.naoLida;
      if (filtro === "aguardando") return c.aguardando;
      if (filtro === "rascunho") return c.temRascunho;
      if (filtro === "sem_vinculo") return !c.clienteId && !c.isGroup;
      return true;
    })
    .filter((c) => {
      const q = busca.trim().toLowerCase();
      if (!q) return true;
      return nomeConv(c, c.contactName).toLowerCase().includes(q) || c.externalPhone.includes(q.replace(/\D/g, "") || q) || c.previa.toLowerCase().includes(q);
    });

  const negociacaoAberta = contexto?.negociacoes[0] ?? null;

  // Mensagens agrupadas por dia (para os separadores).
  const listaMsgs = resultadosBusca ?? mensagens;
  const grupos: { dia: string; itens: Mensagem[] }[] = [];
  for (const m of listaMsgs) {
    const dia = diaChave(m.sentAt);
    const g = grupos[grupos.length - 1];
    if (g && g.dia === dia) g.itens.push(m); else grupos.push({ dia, itens: [m] });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex bg-brand-950 text-brand-100 md:left-64" style={{ top: topo }}>
      {/* ── Coluna 1: conversas ── */}
      <aside className={cn("w-full shrink-0 flex-col border-r border-brand-800 bg-brand-900 lg:flex lg:w-[340px]", sel ? "hidden" : "flex")}>
        <div className="shrink-0 border-b border-brand-800 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-agro-400 text-black"><MessageCircle size={17} /></div>
              <div className="min-w-0">
                <div className="text-base font-bold leading-tight text-white">WhatsApp</div>
                <Link href="/conexao" className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-brand-300 hover:text-white" title="Conexão do WhatsApp">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", conexao.conectado ? "bg-emerald-400" : "bg-red-400")} />
                  {conexao.conectado ? (conexao.provedor === "evolution" ? "Evolution API" : "Z-API") : conexao.configurado ? "desconectado" : "sem conexão"}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" accept=".zip,.txt,.html,.htm" multiple onChange={arquivosEscolhidos} className="hidden" />
              {modoSelecao ? (
                <>
                  <span className="px-1 text-[11px] text-brand-300">{selecionadas.size > 0 ? `${selecionadas.size} selecionada(s)` : "toque para selecionar"}</span>
                  {selecionadas.size > 0 && (
                    <button onClick={excluirSelecionadas} disabled={excluindoSelecao} title="Excluir selecionadas" className={botaoIcone}>
                      {excluindoSelecao ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} className="text-red-400" />}
                    </button>
                  )}
                  <button onClick={() => { setModoSelecao(false); setSelecionadas(new Set()); }} title="Cancelar seleção" className={botaoIcone}><X size={17} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => !importando && fileRef.current?.click()} disabled={importando} title="Importar conversas exportadas do WhatsApp (.zip/.txt)" className={botaoIcone}>
                    {importando ? <Loader2 size={17} className="animate-spin" /> : <DownloadCloud size={17} />}
                  </button>
                  <button
                    onClick={atualizarNomesDaAgenda}
                    disabled={sincNomes}
                    title="Atualizar os nomes como estão salvos na agenda do seu celular"
                    className={botaoIcone}
                  >
                    {sincNomes ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                  </button>
                  <button onClick={() => setModoSelecao(true)} title="Selecionar conversas para excluir" className={botaoIcone}><ListChecks size={17} /></button>
                  <Link href="/atendimento/relatorio" title="Relatório em PDF das conversas" className={botaoIcone}><FileText size={17} /></Link>
                </>
              )}
            </div>
          </div>
          {importMsg && <p className="mt-2 text-[11px] text-agro-300">{importMsg}</p>}
          <div className="relative mt-3">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conversa, telefone ou trecho"
              style={{ paddingLeft: 40, paddingRight: 32 }}
              className="w-full rounded-xl bg-brand-800 py-2 text-sm text-white placeholder:text-brand-400 outline-none ring-1 ring-transparent focus:ring-agro-400/60" />
            {busca && <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-white" aria-label="Limpar"><X size={14} /></button>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {FILTROS.map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)} className={chip(filtro === f.id)} style={{ minHeight: 28 }}>
                {f.label}{f.id === "nao_lidas" && naoLidas > 0 ? ` · ${naoLidas}` : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtradas.length === 0 ? (
            <p className="p-6 text-center text-sm text-brand-400">Nenhuma conversa neste filtro.</p>
          ) : filtradas.map((c) => (
            <button key={c.id} onClick={() => (modoSelecao ? alternarSelecao(c.id) : setSelId(c.id))}
              className={cn("flex w-full items-center gap-3 border-b border-brand-800/70 px-4 py-3 text-left transition", selId === c.id && !modoSelecao ? "bg-white/[0.06]" : "hover:bg-white/[0.03]")}>
              {modoSelecao && (
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border-2", selecionadas.has(c.id) ? "border-agro-400 bg-agro-400 text-black" : "border-brand-600")}>
                  {selecionadas.has(c.id) && <Check size={13} strokeWidth={3} />}
                </span>
              )}
              <Avatar nome={nomeConv(c, c.contactName)} isGroup={c.isGroup} photo={c.contactPhotoUrl} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-sm", c.naoLida ? "font-bold text-white" : "font-semibold text-brand-100")}>{nomeConv(c, c.contactName)}</span>
                  <span className={cn("shrink-0 text-[11px]", c.naoLida ? "font-bold text-agro-400" : "text-brand-400")}>{quandoCurto(c.lastMessageAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] text-brand-400">{c.previa || "—"}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {c.temRascunho && <span title="Rascunho da IA aguardando" className="rounded-full bg-agro-400/20 px-1.5 text-[10px] font-bold text-agro-300">IA</span>}
                    {c.aguardando && <span title="Cliente aguardando sua resposta" className="h-2 w-2 rounded-full bg-orange-400" />}
                    {!c.clienteId && !c.isGroup && <span title="Sem cadastro no CRM" className="text-amber-400"><AlertTriangle size={12} /></span>}
                    {c.naoLida && <span className="h-2.5 w-2.5 rounded-full bg-agro-400" />}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Coluna 2: chat ── */}
      <section className={cn("min-w-0 flex-1 flex-col", sel ? "flex" : "hidden lg:flex")}>
        {!selAtual || !sel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-brand-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-900"><MessageCircle size={30} strokeWidth={1.5} /></div>
            <p className="text-sm">Escolha uma conversa à esquerda.</p>
            {naoLidas > 0 && <button onClick={() => setFiltro("nao_lidas")} className="rounded-full bg-agro-400 px-3 py-1 text-xs font-bold text-black">{naoLidas} não lida(s)</button>}
          </div>
        ) : (
          <>
            {/* Cabeçalho do chat */}
            <div className="flex shrink-0 items-center gap-3 border-b border-brand-800 bg-brand-900 px-3 py-2.5 sm:px-4">
              <button onClick={() => setSelId(null)} className={cn(botaoIcone, "lg:hidden")} aria-label="Voltar"><ArrowLeft size={20} /></button>
              <Avatar nome={nomeConv(sel, selAtual.contactName)} isGroup={sel.isGroup} photo={sel.contactPhotoUrl} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">{nomeConv(sel, selAtual.contactName)}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-brand-300">
                  <span className="truncate">{sel.isGroup ? "Grupo" : telefoneBonito(sel.externalPhone)}</span>
                  {selAtual.clienteId ? (
                    <Link href={`/clientes/${selAtual.clienteId}`} className="inline-flex items-center gap-1 text-agro-300 hover:underline"><User size={11} /> cadastro</Link>
                  ) : !sel.isGroup ? (
                    <button onClick={() => setVincularConv(sel)} className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-1.5 text-amber-300 hover:bg-amber-400/25"><Link2 size={11} /> vincular ao CRM</button>
                  ) : null}
                  {contexto?.cliente?.aguardandoResposta && <span className="rounded bg-orange-400/15 px-1.5 text-orange-300">aguardando você</span>}
                  {selAtual.encerrada && <span className="rounded bg-white/10 px-1.5 text-brand-300">respondido · sem pendência</span>}
                </div>
              </div>
              <button onClick={() => setBuscaMsg((v) => (v == null ? "" : null))} title="Buscar nas mensagens" className={cn(botaoIcone, buscaMsg != null && "bg-white/10 text-white")}><Search size={17} /></button>
              <button onClick={() => setPainelAberto((v) => !v)} title="Painel do Orientador" className={cn(botaoIcone, "xl:hidden", painelAberto && "bg-white/10 text-white")}><PanelRightOpen size={18} /></button>
              <div className="relative">
                <button onClick={() => setMenuAberto((v) => !v)} className={botaoIcone} aria-label="Mais opções"><MoreVertical size={18} /></button>
                {menuAberto && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                    <div className="absolute right-0 top-11 z-20 w-64 rounded-2xl border border-brand-700 bg-brand-900 p-1.5 text-sm shadow-2xl">
                      {[
                        { icone: <CheckCircle2 size={15} className="text-emerald-300" />, rotulo: "Marcar como respondido", acao: () => { setMenuAberto(false); startTransition(async () => { await marcarRespondidoAction(sel.id); carregarContexto(sel.id); router.refresh(); }); } },
                        { icone: <FileText size={15} className="text-amber-300" />, rotulo: "Relatório em PDF desta conversa", href: `/atendimento/relatorio?conversa=${sel.id}` },
                        { icone: <Trash2 size={15} className="text-red-400" />, rotulo: "Excluir conversa", acao: () => excluirConversa(sel), perigo: true },
                      ].map((item) => item.href ? (
                        <Link key={item.rotulo} href={item.href} onClick={() => setMenuAberto(false)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-brand-100 hover:bg-white/10">{item.icone} {item.rotulo}</Link>
                      ) : (
                        <button key={item.rotulo} onClick={item.acao} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10", item.perigo ? "text-red-300" : "text-brand-100")} style={{ minHeight: 36 }}>{item.icone} {item.rotulo}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Busca nas mensagens */}
            {buscaMsg != null && (
              <div className="flex shrink-0 items-center gap-2 border-b border-brand-800 bg-brand-900/70 px-3 py-2">
                <Search size={14} className="text-brand-400" />
                <input autoFocus value={buscaMsg} onChange={(e) => buscarNasMensagens(e.target.value)} placeholder="Buscar nesta conversa (ex.: B95C, entrada, quinta)"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-brand-400 outline-none" />
                {resultadosBusca && <span className="text-[11px] text-brand-400">{resultadosBusca.length} resultado(s)</span>}
                <button onClick={() => { setBuscaMsg(null); setResultadosBusca(null); }} className={botaoIcone} aria-label="Fechar busca"><X size={15} /></button>
              </div>
            )}

            {/* Faixa do Orientador (telas sem o painel lateral) */}
            {contexto?.orientador && (
              <button onClick={() => setPainelAberto(true)} className="flex shrink-0 items-center gap-2 border-b border-brand-800 bg-brand-900/50 px-4 py-1.5 text-left text-xs xl:hidden">
                <Compass size={13} className="shrink-0 text-agro-400" />
                <Temperatura t={contexto.orientador.temperatura} />
                <span className="text-brand-200">{contexto.orientador.estagioVenda}</span>
                {contexto.orientador.probabilidadeFechamento != null && <span className="font-bold text-agro-300">{contexto.orientador.probabilidadeFechamento}%</span>}
                {contexto.orientador.proximaAcao && <span className="truncate text-brand-400">— {contexto.orientador.proximaAcao}</span>}
              </button>
            )}

            {/* Mensagens */}
            <div ref={chatRef} onScroll={() => { const el = chatRef.current; if (el) autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}
              className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
              {!resultadosBusca && temMais && (
                <div className="mb-3 flex justify-center">
                  <button onClick={carregarAnteriores} disabled={carregandoMais} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-brand-300 hover:bg-white/10" style={{ minHeight: 28 }}>
                    {carregandoMais ? <Loader2 size={12} className="animate-spin" /> : <ChevronUp size={12} />} Carregar mensagens anteriores
                  </button>
                </div>
              )}
              {resultadosBusca && resultadosBusca.length === 0 && <p className="py-8 text-center text-sm text-brand-400">Nada encontrado para “{buscaMsg}”.</p>}
              {grupos.map((g) => (
                <div key={g.dia}>
                  <div className="my-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-brand-500"><span className="h-px flex-1 bg-brand-800" />{g.dia}<span className="h-px flex-1 bg-brand-800" /></div>
                  {g.itens.map((m) => {
                    if (m.isDraft) {
                      return (
                        <div key={m.id} className="mb-2 flex justify-end">
                          <div className="w-full max-w-[85%] rounded-2xl rounded-tr-sm border border-dashed border-agro-400/60 bg-agro-400/10 p-3 text-sm sm:max-w-[70%]">
                            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-agro-300"><Brain size={12} /> Sugestão do Orientador · revise antes de enviar</div>
                            <p className="whitespace-pre-wrap break-words text-brand-50">{m.body}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button onClick={() => draftAction(m.id, "send")} disabled={!conexao.conectado} className="inline-flex items-center gap-1 rounded-full bg-agro-400 px-3 py-1 text-xs font-bold text-black hover:bg-agro-300 disabled:opacity-40" style={{ minHeight: 30 }}><Send size={12} /> Enviar</button>
                              <button onClick={() => editarDraft(m)} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15" style={{ minHeight: 30 }}>Editar</button>
                              <button onClick={() => draftAction(m.id, "discard")} className="rounded-full px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10" style={{ minHeight: 30 }}>Descartar</button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const meu = m.direction === "OUT";
                    return (
                      <div key={m.id} className={cn("mb-1.5 flex", meu ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]", meu ? "rounded-tr-sm bg-agro-400/15 text-agro-50 ring-1 ring-agro-400/20" : "rounded-tl-sm bg-brand-800 text-brand-50")}>
                          {!meu && sel.isGroup && m.senderName && <div className="text-[11px] font-bold text-agro-300">{m.senderName}</div>}
                          {meu && m.operatorDisplayName && m.operatorDisplayName !== "Você" && <div className="text-[10px] font-semibold text-agro-300/80">{m.operatorDisplayName}</div>}
                          {m.mediaType === "image" && m.mediaUrl && (
                            <a href={m.mediaUrl} target="_blank" rel="noreferrer" title="Abrir a foto">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.mediaUrl} alt="" className="mb-1 max-h-64 rounded-lg" loading="lazy" />
                            </a>
                          )}
                          {m.mediaType === "image" && !m.mediaUrl && <span className="mr-1 text-brand-400">📷</span>}
                          {(m.mediaType === "document" || m.mediaType === "video") && (
                            m.mediaUrl ? (
                              <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-2 text-xs font-semibold text-agro-200 hover:bg-black/30">
                                <FileDown size={15} /> {m.mediaName ?? (m.mediaType === "video" ? "Vídeo" : "Documento")}
                              </a>
                            ) : (
                              <span className="mb-1 flex items-center gap-2 text-xs text-brand-400"><FileDown size={13} /> {m.mediaName ?? "Documento"} · sem cópia no CRM</span>
                            )
                          )}
                          {m.mediaType === "audio" && m.mediaUrl && !m.mediaUrl.startsWith("/api/") && (
                            <audio controls preload="none" src={m.mediaUrl} className="mb-1 h-9 max-w-full" />
                          )}
                          <span className="whitespace-pre-wrap break-words">{m.body}</span>
                          <span className="ml-2 inline-flex items-center gap-0.5 align-bottom text-[10px] text-brand-400">
                            {hora(m.sentAt)}
                            {meu && (m.sendStatus === "READ" ? <CheckCheck size={13} className="text-sky-400" /> : m.sendStatus === "DELIVERED" ? <CheckCheck size={13} /> : m.sendStatus === "FAILED" ? <span className="font-bold text-red-400" title="Falha no envio">!</span> : <Check size={13} />)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Caixa de texto */}
            <div className="shrink-0 border-t border-brand-800 bg-brand-900 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
              {contexto?.orientador?.melhorResposta && !texto && (
                <button onClick={() => usarResposta(contexto.orientador!.melhorResposta!)} className="mb-2 flex w-full items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-left text-xs text-brand-300 hover:bg-white/[0.07]">
                  <Sparkles size={13} className="mt-0.5 shrink-0 text-agro-400" />
                  <span className="line-clamp-2"><b className="text-agro-300">Usar resposta do Orientador:</b> {contexto.orientador.melhorResposta}</span>
                </button>
              )}
              {anexo && (
                <div className="mb-2 flex items-start gap-3 rounded-xl bg-white/[0.05] p-2.5">
                  {anexo.kind === "image" && anexo.preview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={anexo.preview} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  )}
                  {anexo.kind === "document" && <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-800 text-agro-300"><FileDown size={20} /></div>}
                  {anexo.kind === "audio" && anexo.preview && <audio controls src={anexo.preview} className="h-9 max-w-[220px]" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-white">{anexo.kind === "audio" ? "Áudio gravado" : anexo.fileName} <span className="font-normal text-brand-400">· {Math.max(1, Math.round(anexo.tamanho / 1024))} KB</span></div>
                    {anexo.kind !== "audio" && (
                      <input value={legenda} onChange={(e) => setLegenda(e.target.value)} placeholder="Legenda (opcional)" style={{ paddingLeft: 10, paddingRight: 10 }}
                        className="mt-1 w-full rounded-lg bg-brand-800 py-1.5 text-sm text-white placeholder:text-brand-400 outline-none" />
                    )}
                    <div className="mt-2 flex gap-2">
                      <button onClick={enviarAnexo} disabled={enviandoAnexo || !conexao.conectado} className="inline-flex items-center gap-1 rounded-full bg-agro-400 px-3 py-1 text-xs font-bold text-black disabled:opacity-40" style={{ minHeight: 30 }}>
                        {enviandoAnexo ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Enviar {anexo.kind === "image" ? "foto" : anexo.kind === "audio" ? "áudio" : "arquivo"}
                      </button>
                      <button onClick={() => setAnexo(null)} className="rounded-full px-3 py-1 text-xs font-semibold text-brand-300 hover:bg-white/10" style={{ minHeight: 30 }}>Cancelar</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-end gap-1.5">
                <input ref={anexoRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={escolherAnexo} className="hidden" />
                <button onClick={() => anexoRef.current?.click()} disabled={!conexao.conectado} title="Enviar foto ou documento" className={cn(botaoIcone, "h-11 disabled:opacity-40")}><Paperclip size={18} /></button>
                <button onClick={gravando ? pararGravacao : iniciarGravacao} disabled={!conexao.conectado} title={gravando ? "Parar gravação" : "Gravar áudio"} className={cn(botaoIcone, "h-11 disabled:opacity-40", gravando && "bg-red-500/20 text-red-300")}>
                  {gravando ? <Square size={16} /> : <Mic size={18} />}
                </button>
                {gravando && <span className="self-center text-xs font-bold text-red-300">{Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")}</span>}
                <button onClick={abrirRespostas} title="Respostas prontas" className={cn(botaoIcone, "h-11")}><Zap size={18} /></button>
                <textarea ref={textareaRef} value={texto}
                  onChange={(e) => { setTexto(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  rows={1} placeholder={conexao.conectado ? "Escreva a mensagem (Enter envia, Shift+Enter quebra linha)" : "WhatsApp desconectado — conecte em /conexao"}
                  disabled={!conexao.conectado}
                  className="max-h-36 flex-1 resize-none rounded-xl bg-brand-800 px-3 py-2.5 text-sm text-white placeholder:text-brand-400 outline-none ring-1 ring-transparent focus:ring-agro-400/60 disabled:opacity-60" />
                <button onClick={enviar} disabled={enviando || !texto.trim() || !conexao.conectado} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-agro-400 text-black transition hover:bg-agro-300 disabled:opacity-40" aria-label="Enviar">
                  {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Coluna 3: contexto + Orientador ── */}
      {sel && (
        <aside className={cn(
          "w-[320px] shrink-0 flex-col border-l border-brand-800 bg-brand-900 xl:flex",
          painelAberto ? "absolute inset-y-0 right-0 z-30 flex w-full shadow-2xl sm:w-[360px]" : "hidden"
        )}>
          <div className="flex shrink-0 items-center justify-between border-b border-brand-800 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white"><Compass size={16} className="text-agro-400" /> Orientador de Vendas</div>
            <div className="flex items-center gap-1">
              {contexto?.cliente && (
                <button onClick={reanalisar} disabled={reanalisando} title="Reanalisar a conversa agora" className={cn("flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold transition", reanalisando ? "text-brand-400" : "bg-white/5 text-agro-300 hover:bg-white/10")}>
                  <RefreshCw size={13} className={reanalisando ? "animate-spin" : ""} /> {reanalisando ? "Analisando…" : "Reanalisar"}
                </button>
              )}
              <button onClick={() => setPainelAberto(false)} className={cn(botaoIcone, "xl:hidden")} aria-label="Fechar painel"><X size={16} /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
            {avisoPainel && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{avisoPainel}</p>}
            {carregandoContexto && !contexto ? (
              <div className="flex items-center gap-2 text-brand-400"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
            ) : !contexto?.cliente ? (
              <div className="space-y-3 text-brand-300">
                <p>Esta conversa ainda não está ligada a um cliente. Vincule para o Orientador analisar e para a negociação entrar no funil.</p>
                {!sel.isGroup && <button onClick={() => setVincularConv(sel)} className="inline-flex items-center gap-1 rounded-lg bg-agro-400 px-3 py-1.5 text-xs font-bold text-black"><Link2 size={13} /> Vincular a um cliente</button>}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cliente */}
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/clientes/${contexto.cliente.id}`} className="font-bold text-white hover:text-agro-300">{contexto.cliente.nome}</Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-brand-300">
                        {contexto.cliente.municipio && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {contexto.cliente.municipio}</span>}
                        <span>{contexto.cliente.jaComprou ? "já é cliente" : "potencial"}</span>
                        <span title="Lead score">score {contexto.cliente.leadScore}</span>
                      </div>
                    </div>
                    {contexto.cliente.aguardandoResposta && <span className="rounded-full bg-orange-400/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">aguardando</span>}
                  </div>
                  {/* Só o assunto da ÚLTIMA conversa. Antes eram as duas
                      últimas linhas do resumo coladas com espaço — e como o
                      resumo é um log de uma linha por mensagem analisada, as
                      duas costumam ser quase iguais: era daí que vinha a
                      sensação de card duplicado. */}
                  {assuntoDaUltimaConversa(contexto.cliente.resumoTexto) && (
                    <p className="mt-2 line-clamp-3 text-xs text-brand-300">{assuntoDaUltimaConversa(contexto.cliente.resumoTexto)}</p>
                  )}
                  {/* A leitura do momento (temperatura, estágio, chance, perfil)
                      e a próxima ação moram aqui dentro, junto do nome e do
                      assunto — é o cartão que o vendedor olha primeiro. */}
                  {contexto.orientador && (
                    <>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-2 text-xs">
                        <Temperatura t={contexto.orientador.temperatura} />
                        <span className="text-brand-200">{contexto.orientador.estagioVenda}</span>
                        {contexto.orientador.probabilidadeFechamento != null && <span className="rounded-full bg-agro-400/15 px-2 py-0.5 font-bold text-agro-300">{contexto.orientador.probabilidadeFechamento}% de fechar</span>}
                        {contexto.orientador.coaching?.personalidade.estilo && <span className="text-brand-400">cliente {contexto.orientador.coaching.personalidade.estilo}{contexto.orientador.coaching.personalidade.papel ? ` · ${contexto.orientador.coaching.personalidade.papel}` : ""}</span>}
                      </div>
                      {contexto.orientador.proximaAcao && (
                        <div className="mt-2 rounded-xl border border-agro-400/30 bg-agro-400/10 p-2.5 text-xs text-agro-50"><b className="text-agro-300">Próxima ação:</b> {contexto.orientador.proximaAcao}</div>
                      )}
                    </>
                  )}
                </div>

                {/* Negociação — o segundo card. Três informações e só três:
                    máquina, valor e como vai pagar. A que já foi identificada
                    ganha "Verificado" em verde (mesmo ✓ de "Sua condução");
                    a que falta fica apagada, para o vendedor ver o buraco. */}
                <div>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-400">Negociação</div>
                  {contexto.negociacoes.length === 0 ? (
                    <p className="text-xs text-brand-400">Nenhuma negociação aberta. Quando houver sinal de compra o ZEUS abre uma automaticamente.</p>
                  ) : contexto.negociacoes.map((n) => (
                    <div key={n.id} className="mb-2 space-y-1 rounded-xl bg-white/[0.04] p-3 text-xs">
                      <ItemVerificado rotulo="Máquina" valor={maquinaDaNegociacao(n.marca, n.maquina)} falta="modelo ainda não definido" />
                      <ItemVerificado rotulo="Valor negociado" valor={n.valor ? formatCurrency(n.valor) : null} falta="valor ainda não negociado" />
                      <ItemVerificado rotulo="Pagamento" valor={pagamentoDaNegociacao(n.tipoPagamento, n.condicaoPagamento)} falta="à vista, financiado, consórcio ou parcelado pela casa — ainda não definido" />
                      {n.concorrente && <div className="flex gap-1.5 text-red-300"><span className="w-3 shrink-0 text-center">▼</span><span>Concorrente na mesa: {n.concorrente}</span></div>}
                    </div>
                  ))}
                </div>

                {/* Leitura do Orientador — coach de vendas ao lado do vendedor.
                    Ordem: primeiro o que FAZER agora (alerta, perguntas,
                    resposta pronta, avaliação da sua condução); depois o
                    porquê e o contexto (resumo, personalidade, roteiro,
                    combinados, objeções, sinais). Cada seção mostra algo que
                    nenhuma outra mostra — sem repetir a mesma frase duas vezes.
                    A temperatura, o estágio, a chance e a próxima ação ficam
                    no card do cliente, lá em cima; a máquina, o valor e o
                    pagamento ficam no card Negociação, logo abaixo dele. */}
                {contexto.orientador ? (() => {
                  const o = contexto.orientador;
                  const c = o.coaching;
                  const corAlerta = { vermelho: "border-red-400/40 bg-red-400/10 text-red-50", amarelo: "border-amber-400/40 bg-amber-400/10 text-amber-50", verde: "border-emerald-400/40 bg-emerald-400/10 text-emerald-50" } as const;
                  const corTitulo = { vermelho: "text-red-300", amarelo: "text-amber-300", verde: "text-emerald-300" } as const;
                  const corNota = c ? (c.conducao.nota >= 8 ? "text-emerald-300" : c.conducao.nota >= 6 ? "text-amber-300" : "text-red-300") : "text-brand-300";
                  return (
                  <div className="space-y-2.5">
                    {/* ── O que fazer agora ─────────────────────────────── */}
                    {c?.alertaAgora && (
                      <div className={cn("rounded-xl border p-2.5 text-xs", corAlerta[c.alertaAgora.nivel])}>
                        <div className={cn("flex items-center gap-1.5 font-bold", corTitulo[c.alertaAgora.nivel])}><AlertTriangle size={13} /> {c.alertaAgora.titulo}</div>
                        {c.alertaAgora.motivo && <p className="mt-1">{c.alertaAgora.motivo}</p>}
                      </div>
                    )}
                    {c && (c.perguntasAgora.length > 0 || c.informacoesFaltando.length > 0) && (
                      <div className="rounded-xl bg-white/[0.04] p-2.5 text-xs text-brand-200">
                        {c.perguntasAgora.length > 0 && (
                          <>
                            <b className="text-agro-300">Pergunte agora (nesta ordem):</b>
                            <ol className="mt-1 list-decimal space-y-0.5 pl-4">{c.perguntasAgora.map((q) => <li key={q}>{q}</li>)}</ol>
                          </>
                        )}
                        {c.informacoesFaltando.length > 0 && (
                          <p className={cn("text-[11px] text-brand-400", c.perguntasAgora.length > 0 && "mt-1.5")}><b className="text-brand-300">Falta saber:</b> {c.informacoesFaltando.join(" · ")}</p>
                        )}
                      </div>
                    )}
                    {o.melhorResposta && (
                      <button onClick={() => usarResposta(o.melhorResposta!)} className="w-full rounded-xl bg-white/[0.04] p-2.5 text-left text-xs text-brand-200 hover:bg-white/[0.08]">
                        <div className="mb-1 flex items-center gap-1 font-bold text-agro-300"><Sparkles size={12} /> Melhor resposta · clique para usar <span className="font-normal text-brand-500">· {contexto.estiloAprendido ? "no seu jeito de falar" : "tom padrão (ainda aprendendo o seu jeito)"}</span></div>
                        <p className="line-clamp-4">{o.melhorResposta}</p>
                      </button>
                    )}
                    {c && (c.conducao.acertos.length > 0 || c.conducao.correcoes.length > 0) && (
                      <div className="rounded-xl bg-white/[0.04] p-2.5 text-xs text-brand-200">
                        <div className="flex items-center justify-between"><b className="text-brand-100">Sua condução</b><span className={cn("font-bold", corNota)}>nota {c.conducao.nota}/10</span></div>
                        {c.conducao.acertos.length > 0 && <ul className="mt-1 space-y-0.5">{c.conducao.acertos.map((a) => <li key={a} className="flex gap-1.5 text-emerald-200"><span>✓</span><span>{a}</span></li>)}</ul>}
                        {c.conducao.correcoes.length > 0 && <ul className="mt-1 space-y-0.5">{c.conducao.correcoes.map((a) => <li key={a} className="flex gap-1.5 text-amber-100"><span>→</span><span>{a}</span></li>)}</ul>}
                      </div>
                    )}

                    {/* ── Contexto e porquê ─────────────────────────────── */}
                    {o.resumoNegociacao && <p className="text-xs text-brand-200">{o.resumoNegociacao}</p>}
                    {c?.personalidade.estilo && (
                      <div className="rounded-xl bg-white/[0.04] p-2.5 text-xs text-brand-200">
                        <b className="text-brand-100">Como conduzir este cliente</b> <span className="text-brand-400">· perfil {c.personalidade.estilo}</span>
                        {c.personalidade.descricao && <p className="mt-1 text-brand-300">{c.personalidade.descricao}</p>}
                        {c.personalidade.comoFalar.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4">{c.personalidade.comoFalar.map((x) => <li key={x}>{x}</li>)}</ul>}
                        {c.personalidade.evitar.length > 0 && <p className="mt-1 text-red-200"><b>Evite:</b> {c.personalidade.evitar.join(" · ")}</p>}
                      </div>
                    )}
                    {c && c.roteiro.length > 0 && (
                      <div className="rounded-xl bg-white/[0.04] p-2.5 text-xs">
                        <b className="text-brand-100">Roteiro até o fechamento</b>
                        <ol className="mt-1 space-y-1">
                          {c.roteiro.map((e) => (
                            <li key={e.etapa} className={cn("flex gap-2", e.status === "feito" ? "text-brand-500" : e.status === "agora" ? "text-agro-200" : "text-brand-300")}>
                              <span className="w-4 shrink-0 text-center">{e.status === "feito" ? "✓" : e.status === "agora" ? "▶" : "○"}</span>
                              <span><b className={e.status === "agora" ? "text-agro-300" : ""}>{e.etapa}</b>{e.dica ? ` — ${e.dica}` : ""}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {o.combinados.length > 0 && (
                      <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-2.5 text-xs text-emerald-50">
                        <b className="text-emerald-300">Já combinado:</b>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">{o.combinados.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    )}
                    {o.pendencias.length > 0 && (
                      <div className="text-xs text-brand-300"><b className="text-brand-200">Pendências:</b>
                        <ul className="mt-0.5 list-disc space-y-0.5 pl-4">{o.pendencias.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    )}
                    {c && c.tratamentoObjecoes.length > 0 ? (
                      <div className="text-xs text-brand-300"><b className="text-brand-200">Objeções e como tratar:</b>
                        <ul className="mt-0.5 space-y-0.5">{c.tratamentoObjecoes.map((t) => <li key={t.objecao}><b className="text-brand-200">{t.objecao}:</b> {t.comoTratar}</li>)}</ul>
                      </div>
                    ) : o.objecoes.length > 0 ? (
                      <div className="text-xs text-brand-300"><b className="text-brand-200">Objeções:</b> {o.objecoes.join(", ")}</div>
                    ) : null}
                    {c && (c.sinaisCompra.length > 0 || c.sinaisRisco.length > 0) && (
                      <div className="grid grid-cols-1 gap-1 text-xs">
                        {c.sinaisCompra.map((x) => <div key={x} className="text-emerald-300">▲ {x}</div>)}
                        {c.sinaisRisco.map((x) => <div key={x} className="text-red-300">▼ {x}</div>)}
                      </div>
                    )}
                    {o.oportunidadesPerdidas.length > 0 && (
                      <ul className="list-disc space-y-0.5 pl-4 text-xs text-brand-400">
                        {o.oportunidadesPerdidas.slice(0, 3).map((x) => <li key={x}>{x}</li>)}
                      </ul>
                    )}
                    {o.probabilidadeExplicacao && <p className="text-[11px] text-brand-500">{o.probabilidadeExplicacao}</p>}
                  </div>
                  );
                })() : (
                  <p className="text-xs text-brand-400">O Orientador analisa a conversa quando chega a próxima mensagem do cliente.</p>
                )}

                {/* Visitas */}
                <div className="text-xs">
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <div className="mb-1 flex items-center gap-1 font-bold text-brand-200"><Calendar size={12} className="text-sky-300" /> Visitas</div>
                    {contexto.sugestaoVisita && (
                      <div className="mb-1.5 rounded-lg bg-sky-400/10 px-2 py-1 text-[11px] text-sky-100"><b className="text-sky-300">Melhor dia para visitar:</b> {contexto.sugestaoVisita}</div>
                    )}
                    {contexto.visitas.length === 0 && !contexto.cliente.proximaVisita ? (
                      <Link href={`/clientes/${contexto.cliente.id}`} className="text-brand-400 hover:text-agro-300">Nenhuma marcada · agendar no cadastro</Link>
                    ) : (
                      <ul className="space-y-0.5 text-brand-300">
                        {contexto.visitas.map((v) => <li key={v.id}>{new Date(v.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}{v.observacao ? ` · ${v.observacao}` : ""}</li>)}
                        {contexto.cliente.proximaVisita && contexto.visitas.length === 0 && <li>{new Date(contexto.cliente.proximaVisita).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}{contexto.cliente.proximaVisitaNota ? ` · ${contexto.cliente.proximaVisitaNota}` : ""}</li>}
                      </ul>
                    )}
                  </div>
                </div>

                {contexto.alertas.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-brand-400"><Bell size={11} /> Alertas</div>
                    {contexto.alertas.map((a) => (
                      <div key={a.id} className="mb-1.5 flex items-start justify-between gap-2 rounded-lg bg-orange-400/10 p-2 text-xs text-orange-100">
                        <span>{a.mensagem}</span>
                        <button onClick={() => { setContexto((c) => c ? { ...c, alertas: c.alertas.filter((x) => x.id !== a.id) } : c); resolverAlertaConversaAction(a.id); }} title="Resolvido" className="shrink-0 text-orange-300 hover:text-white"><CheckCircle2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
                  <Link href={`/clientes/${contexto.cliente.id}`} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold text-white hover:bg-white/15"><User size={12} /> Cadastro</Link>
                  {negociacaoAberta && <Link href={`/negociacoes/${negociacaoAberta.id}/proposta`} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold text-white hover:bg-white/15"><Wallet size={12} /> Calculadora</Link>}
                </div>

                {/* O que o vendedor sabe e o WhatsApp não mostra. O Orientador
                    só enxerga a conversa; o que foi combinado por telefone ou
                    na visita ficava de fora e a leitura saía torta. Aqui ele
                    escreve, e isso entra em TODA análise daí em diante. */}
                <div className="rounded-xl border border-agro-400/30 bg-agro-400/[0.06] p-3">
                  <label htmlFor="nota-orientador" className="flex items-center gap-1.5 text-xs font-bold text-agro-300">
                    <Sparkles size={13} /> O que o Orientador precisa saber
                  </label>
                  <p className="mt-0.5 text-[11px] text-brand-300">
                    O que ficou combinado por telefone, o que você viu na visita, o que o cliente falou fora do WhatsApp. Entra na análise como fato.
                  </p>
                  <textarea
                    id="nota-orientador"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    disabled={salvandoNota}
                    rows={3}
                    maxLength={4000}
                    placeholder="Ex.: falei por telefone, ele quer a D150 com entrada de 30% e quer fechar até o fim do mês. Já tem o banco aprovado."
                    className="mt-2 w-full resize-y rounded-lg border border-brand-700 bg-brand-950/60 px-2.5 py-2 text-xs text-white placeholder:text-brand-500 focus:border-agro-400 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-brand-500">{nota.length}/4000</span>
                    <button
                      onClick={salvarNotaEReanalisar}
                      disabled={salvandoNota}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition",
                        salvandoNota ? "bg-white/5 text-brand-400" : "bg-agro-400 text-brand-950 hover:bg-agro-300",
                      )}
                    >
                      {salvandoNota ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {salvandoNota ? "Atualizando…" : "Salvar e atualizar"}
                    </button>
                  </div>
                  {notaAviso && <p className="mt-1.5 text-[11px] text-agro-300">{notaAviso}</p>}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {respostasAbertas && (
        <RespostasProntasModal
          respostas={respostas}
          onFechar={() => setRespostasAbertas(false)}
          onUsar={aplicarRespostaPronta}
          onAtualizar={async () => setRespostas(await listarRespostasProntasAction().catch(() => []))}
        />
      )}
      {vincularConv && (
        <VincularContatoModal conv={vincularConv} onClose={() => setVincularConv(null)}
          onVinculado={(clienteId) => { patchConv(vincularConv, { clienteId }); setVincularConv(null); if (selId) setTimeout(() => carregarContexto(selId), 800); }} />
      )}
    </div>
  );
}

// ── Modal Vincular Contato ────────────────────────────────────────────────────
function VincularContatoModal({ conv, onClose, onVinculado }: {
  conv: ConvLista;
  onClose: () => void;
  onVinculado: (clienteId: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<{ id: string; nome: string; telefone: string | null }[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setCarregando(true);
    fetch(`/api/clientes/busca?q=${encodeURIComponent(busca || conv.externalPhone)}`)
      .then((r) => r.json()).then((d) => setClientes(d.clientes ?? [])).catch(() => {}).finally(() => setCarregando(false));
  }, [busca, conv.externalPhone]);

  async function vincular(clienteId: string) {
    setSalvando(true);
    try {
      await fetch(`/api/conversations/${conv.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clienteId }) });
      onVinculado(clienteId);
    } catch {
      window.alert("Erro ao vincular contato.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-brand-700 bg-brand-900 text-brand-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-brand-800 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-white"><Link2 size={16} className="text-agro-400" /> Vincular a um cliente</h3>
            <p className="mt-0.5 text-xs text-brand-400">{telefoneBonito(conv.externalPhone)}</p>
          </div>
          <button onClick={onClose} className={botaoIcone}><X size={18} /></button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-brand-300">Escolha o cliente do CRM desta conversa. O Orientador passa a usar o cadastro nas respostas e a negociação entra no funil.</p>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone" autoFocus
            className="w-full rounded-xl bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-400 outline-none focus:ring-1 focus:ring-agro-400/60" />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {carregando ? (
              <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-brand-400" /></div>
            ) : clientes.length === 0 ? (
              <p className="py-4 text-center text-sm text-brand-400">Nenhum cliente encontrado</p>
            ) : clientes.map((c) => (
              <button key={c.id} onClick={() => vincular(c.id)} disabled={salvando}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10 disabled:opacity-50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-agro-400/20 text-sm font-bold text-agro-300">{c.nome.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="text-sm font-semibold text-white">{c.nome}</div>
                  {c.telefone && <div className="text-xs text-brand-400">{telefoneBonito(c.telefone)}</div>}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-brand-800 pt-2">
            <p className="text-xs text-brand-400">Não encontrou? <Link href={`/clientes?q=${encodeURIComponent(conv.externalPhone.replace(/\D/g, ""))}`} className="text-agro-300 hover:underline">Abrir Clientes</Link> e cadastrar com este telefone (o ZEUS vincula sozinho na próxima mensagem).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Respostas prontas ────────────────────────────────────────────────────────
function RespostasProntasModal({ respostas, onFechar, onUsar, onAtualizar }: {
  respostas: RespostaPronta[] | null;
  onFechar: () => void;
  onUsar: (r: RespostaPronta) => void;
  onAtualizar: () => Promise<void>;
}) {
  const [editando, setEditando] = useState<{ id?: string; titulo: string; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  async function salvar() {
    if (!editando) return;
    setSalvando(true);
    const r = await salvarRespostaProntaAction(editando).catch(() => ({ ok: false, erro: "Falha ao salvar." }));
    setSalvando(false);
    if (!r.ok) { window.alert(r.erro ?? "Falha ao salvar."); return; }
    setEditando(null);
    await onAtualizar();
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir esta resposta pronta?")) return;
    await excluirRespostaProntaAction(id);
    await onAtualizar();
  }

  const lista = (respostas ?? []).filter((r) => !busca.trim() || `${r.titulo} ${r.texto}`.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onFechar}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-brand-700 bg-brand-900 text-brand-100 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-brand-800 px-4 py-3">
          <h3 className="flex items-center gap-2 font-bold text-white"><Zap size={16} className="text-agro-400" /> Respostas prontas</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setEditando({ titulo: "", texto: "" })} className="inline-flex h-9 items-center gap-1 rounded-lg bg-white/5 px-2.5 text-xs font-bold text-agro-300 hover:bg-white/10"><Plus size={13} /> Nova</button>
            <button onClick={onFechar} className={botaoIcone}><X size={18} /></button>
          </div>
        </div>
        <div className="px-4 pt-3">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar resposta" style={{ paddingLeft: 12, paddingRight: 12 }}
            className="w-full rounded-xl bg-brand-800 py-2 text-sm text-white placeholder:text-brand-400 outline-none" />
          <p className="mt-1 text-[11px] text-brand-400">Use {"{nome}"} para o primeiro nome do cliente e {"{vendedor}"} para o seu.</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {editando && (
            <div className="rounded-xl border border-agro-400/40 bg-agro-400/5 p-3">
              <input value={editando.titulo} onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} placeholder="Título (ex.: Pedido de preço)" style={{ paddingLeft: 10, paddingRight: 10 }}
                className="mb-2 w-full rounded-lg bg-brand-800 py-1.5 text-sm font-semibold text-white placeholder:text-brand-400 outline-none" />
              <textarea value={editando.texto} onChange={(e) => setEditando({ ...editando, texto: e.target.value })} rows={4} placeholder="Texto da resposta"
                className="w-full rounded-lg bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-400 outline-none" />
              <div className="mt-2 flex gap-2">
                <button onClick={salvar} disabled={salvando} className="rounded-full bg-agro-400 px-3 py-1 text-xs font-bold text-black disabled:opacity-50" style={{ minHeight: 30 }}>{salvando ? "Salvando…" : "Salvar"}</button>
                <button onClick={() => setEditando(null)} className="rounded-full px-3 py-1 text-xs font-semibold text-brand-300 hover:bg-white/10" style={{ minHeight: 30 }}>Cancelar</button>
              </div>
            </div>
          )}
          {respostas === null ? (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-brand-400" /></div>
          ) : lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-brand-400">Nenhuma resposta. Crie a primeira em “Nova”.</p>
          ) : lista.map((r) => (
            <div key={r.id} className="group rounded-xl bg-white/[0.04] p-3 transition hover:bg-white/[0.08]">
              <button onClick={() => onUsar(r)} className="w-full text-left">
                <div className="text-sm font-bold text-white">{r.titulo}</div>
                <p className="mt-0.5 line-clamp-3 text-xs text-brand-300">{r.texto}</p>
              </button>
              <div className="mt-2 flex gap-2 text-[11px]">
                <button onClick={() => onUsar(r)} className="font-bold text-agro-300 hover:underline">Usar</button>
                <button onClick={() => setEditando({ id: r.id, titulo: r.titulo, texto: r.texto })} className="text-brand-300 hover:underline">Editar</button>
                <button onClick={() => excluir(r.id)} className="text-red-300 hover:underline">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
