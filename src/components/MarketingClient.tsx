"use client";

// Sessão de Marketing: o Cérebro escreve o post (legenda + hashtags) e cria a
// arte com o Gemini. O vendedor escolhe o tipo (dia, semana, mês, campanha,
// promoção), o tema e a máquina, revisa, salva e publica — ou manda direto
// para a carteira pelo envio em lote do WhatsApp.

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles, Image as ImageIcon, Loader2, Copy, Check, Save, Trash2, Send, CalendarDays, Megaphone, Rocket, Newspaper, Tag, Download, Paperclip,
} from "lucide-react";
import {
  gerarLegendaAction, gerarArtePostAction, salvarPostAction, excluirPostAction, marcarPostPublicadoAction,
  prepararEnvioDoPostAction, type PostSalvo,
} from "@/lib/marketing-actions";
import { TIPOS_POST, TEMAS_SUGERIDOS, CANAIS, limiteDoCanal, textoParaPublicar, type TipoPost, type CanalPost } from "@/lib/marketing-regra";
import { cn } from "@/lib/utils";

const ICONE_TIPO: Record<TipoPost, typeof Megaphone> = {
  diario: Newspaper, semanal: CalendarDays, mensal: Rocket, campanha: Megaphone, promocao: Tag,
};

const campo = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400";
const rotulo = "mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";

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

export function MarketingClient({ posts: postsIniciais, maquinas, temIA, temImagem }: {
  posts: PostSalvo[];
  maquinas: { marca: string; modelo: string }[];
  temIA: boolean;
  temImagem: boolean;
}) {
  const [posts, setPosts] = useState(postsIniciais);
  const [tipo, setTipo] = useState<TipoPost>("diario");
  const [tema, setTema] = useState("");
  const [canal, setCanal] = useState<CanalPost>("instagram");
  // Marca e modelo em dois campos. Numa lista só, as 145 máquinas viravam um
  // rolo sem fim: as Dynapac ocupavam a tela inteira e as New Holland ficavam
  // lá embaixo, dando a impressão de que só existia uma marca.
  const [marca, setMarca] = useState("");
  const [maquina, setMaquina] = useState("");

  const marcas = useMemo(
    () => [...new Set(maquinas.map((m) => m.marca))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [maquinas],
  );
  const modelosDaMarca = useMemo(
    () => maquinas.filter((m) => m.marca === marca).sort((a, b) => a.modelo.localeCompare(b.modelo, "pt-BR", { numeric: true })),
    [maquinas, marca],
  );
  const [instrucoes, setInstrucoes] = useState("");
  const [legenda, setLegenda] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [ideiaDeArte, setIdeiaDeArte] = useState("");
  // Imagens de referência: foto da máquina dele, arte antiga no estilo que
  // ele quer. O Gemini usa como base — é o que faz a arte sair com a máquina
  // certa em vez de uma inventada.
  const [referencias, setReferencias] = useState<{ nome: string; url: string; base64: string; mime: string }[]>([]);
  const refArquivo = useRef<HTMLInputElement>(null);
  const [imagem, setImagem] = useState<{ url: string; base64: string; mime: string } | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [escrevendo, setEscrevendo] = useState(false);
  const [desenhando, setDesenhando] = useState(false);
  const [salvando, start] = useTransition();

  const sugestoes = TEMAS_SUGERIDOS[tipo];
  const limite = limiteDoCanal(canal);
  // O que vai para o Cérebro: "New Holland E145C" quando tem modelo, só a
  // marca quando ele escolheu a marca e deixou o modelo em aberto.
  const maquinaCompleta = useMemo(
    () => [marca, maquina].filter(Boolean).join(" ") || null,
    [marca, maquina],
  );
  const pedido = useMemo(() => ({ tipo, tema, canal, maquina: maquinaCompleta, instrucoes: instrucoes || null }), [tipo, tema, canal, maquinaCompleta, instrucoes]);

  function limpar() {
    setEditando(null); setLegenda(""); setHashtags(""); setIdeiaDeArte(""); setImagem(null);
    setTema(""); setInstrucoes(""); setErro(null); setAviso(null);
    // Libera as URLs locais das miniaturas, senão ficam presas na memória do
    // navegador a cada post novo.
    setReferencias((lista) => { lista.forEach((r) => URL.revokeObjectURL(r.url)); return []; });
  }

  async function escrever() {
    setErro(null); setAviso(null); setEscrevendo(true);
    const r = await gerarLegendaAction(pedido);
    setEscrevendo(false);
    if (!r.ok) { setErro(r.erro ?? "Não consegui escrever agora."); return; }
    setLegenda(r.legenda ?? "");
    setHashtags(r.hashtags ?? "");
    setIdeiaDeArte(r.ideiaDeArte ?? "");
  }

  // Lê os arquivos escolhidos como base64 (é o formato que o Gemini aceita).
  // Limite de 4 MB por imagem: acima disso o pedido fica pesado demais e o
  // Gemini recusa — melhor avisar aqui do que deixar falhar lá.
  async function anexosEscolhidos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!arquivos.length) return;
    setErro(null);
    const novos: typeof referencias = [];
    for (const f of arquivos.slice(0, 4 - referencias.length)) {
      if (!f.type.startsWith("image/")) { setErro(`"${f.name}" não é uma imagem.`); continue; }
      if (f.size > 4 * 1024 * 1024) { setErro(`"${f.name}" passa de 4 MB. Use uma imagem menor.`); continue; }
      const base64 = await new Promise<string>((ok, falhou) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result).split(",")[1] ?? "");
        fr.onerror = () => falhou(fr.error);
        fr.readAsDataURL(f);
      }).catch(() => "");
      if (base64) novos.push({ nome: f.name, url: URL.createObjectURL(f), base64, mime: f.type });
    }
    if (novos.length) setReferencias((r) => [...r, ...novos].slice(0, 4));
  }

  async function desenhar() {
    setErro(null); setAviso(null); setDesenhando(true);
    const r = await gerarArtePostAction({
      ...pedido,
      ideiaDeArte: ideiaDeArte || null,
      referencias: referencias.map((x) => ({ base64: x.base64, mime: x.mime })),
    });
    setDesenhando(false);
    if (!r.ok || !r.imagem || !r.base64) { setErro(r.erro ?? "Não consegui criar a arte."); return; }
    setImagem({ url: r.imagem, base64: r.base64, mime: r.mime ?? "image/png" });
  }

  function salvar(status: PostSalvo["status"] = "pronto") {
    setErro(null);
    start(async () => {
      const r = await salvarPostAction({
        id: editando, tipo, tema, canal, legenda, hashtags,
        maquina: maquinaCompleta, base64: imagem?.base64 ?? null, mime: imagem?.mime ?? null, status,
      });
      if (!r.ok || !r.post) { setErro(r.erro ?? "Não consegui salvar."); return; }
      setPosts((lista) => [r.post!, ...lista.filter((p) => p.id !== r.post!.id)]);
      setEditando(r.post.id);
      setAviso("Post salvo.");
    });
  }

  function abrir(p: PostSalvo) {
    setEditando(p.id); setTipo(p.tipo); setTema(p.tema); setCanal(p.canal ?? "instagram");
    setLegenda(p.legenda); setHashtags(p.hashtags);
    // O post guarda "Marca Modelo" numa string só: separa de volta nos dois
    // campos, senão reabrir um post perdia a escolha da máquina.
    const salvo = (p.maquina ?? "").trim();
    const marcaSalva = marcas.find((m) => salvo === m || salvo.startsWith(m + " ")) ?? "";
    setMarca(marcaSalva);
    setMaquina(marcaSalva ? salvo.slice(marcaSalva.length).trim() : salvo);
    setImagem(p.imagem ? { url: p.imagem, base64: "", mime: "image/png" } : null);
    setErro(null); setAviso(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function excluir(id: string) {
    if (!window.confirm("Apagar este post?")) return;
    setPosts((lista) => lista.filter((p) => p.id !== id));
    if (editando === id) limpar();
    void excluirPostAction(id);
  }

  function publicado(p: PostSalvo) {
    const novo = p.status !== "publicado";
    setPosts((lista) => lista.map((x) => (x.id === p.id ? { ...x, status: novo ? "publicado" : "pronto" } : x)));
    void marcarPostPublicadoAction(p.id, novo);
  }

  async function copiar() {
    await navigator.clipboard.writeText(textoParaPublicar(legenda, hashtags)).catch(() => null);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  }

  async function mandarParaClientes(p: PostSalvo) {
    const r = await prepararEnvioDoPostAction(p.id);
    if (!r.ok) { setErro(r.erro ?? "Não consegui preparar o envio."); return; }
    // O envio em lote é a aba ao lado: leva o texto pronto na área de
    // transferência e abre lá com o anexo já guardado.
    await navigator.clipboard.writeText(r.texto ?? "").catch(() => null);
    setAviso("Texto copiado. Abrindo o envio para clientes…");
    setTimeout(() => { window.location.href = "/marketing?aba=mensagem"; }, 900);
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ── Criação ── */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TIPOS_POST.map((t) => {
              const Icone = ICONE_TIPO[t.id];
              return (
                <Chip key={t.id} ativo={tipo === t.id} onClick={() => { setTipo(t.id); setTema(""); }}>
                  <Icone size={13} /> {t.nome}
                </Chip>
              );
            })}
          </div>
          <p className="mb-3 text-xs text-slate-500">{TIPOS_POST.find((t) => t.id === tipo)?.descricao}</p>

          <label className={rotulo}>Tema</label>
          <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Escreva o tema ou escolha abaixo" className={campo} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sugestoes.map((s) => (
              <button key={s} type="button" onClick={() => setTema(s)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-200">
                {s}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={rotulo}>Canal</label>
              <select value={canal} onChange={(e) => setCanal(e.target.value as CanalPost)} className={campo}>
                {CANAIS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={rotulo}>Marca</label>
              <select
                value={marca}
                // Trocou de marca: o modelo antigo é de outra marca, então sai.
                onChange={(e) => { setMarca(e.target.value); setMaquina(""); }}
                className={campo}
              >
                <option value="">Nenhuma em especial</option>
                {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={rotulo}>Modelo</label>
              <select
                value={maquina}
                onChange={(e) => setMaquina(e.target.value)}
                disabled={!marca}
                className={`${campo} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
              >
                <option value="">{marca ? "Todos da marca" : "Escolha a marca antes"}</option>
                {modelosDaMarca.map((m) => <option key={m.modelo} value={m.modelo}>{m.modelo}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className={rotulo}>O que você quer destacar (opcional)</label>
            <textarea
              value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} rows={2}
              placeholder="Ex.: entrega em 30 dias já acertada com a fábrica; falar da assistência em Cachoeiro"
              className={`${campo} resize-y`}
            />
            <p className="mt-1 text-[11px] text-slate-400">O Cérebro só fala de preço, prazo ou condição se você escrever aqui.</p>
          </div>

          {/* Anexo de referência: sem isto, a arte saía com uma máquina
              genérica inventada. Com a foto da máquina dele, sai a máquina
              certa, com a cor e a marca certas. */}
          <div className="mt-3">
            <label className={rotulo}>Imagem de referência para a arte (opcional)</label>
            <input ref={refArquivo} type="file" accept="image/*" multiple onChange={anexosEscolhidos} className="hidden" />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {referencias.map((r, i) => (
                <div key={r.url} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={r.nome} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setReferencias((lista) => lista.filter((_, j) => j !== i))}
                    title="Tirar esta imagem"
                    className="absolute right-0 top-0 rounded-bl-lg bg-black/60 px-1 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {referencias.length < 4 && (
                <button
                  type="button"
                  onClick={() => refArquivo.current?.click()}
                  className="inline-flex h-16 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-xs font-semibold text-slate-500 hover:border-agro-400 hover:text-slate-700"
                >
                  <Paperclip size={14} /> Anexar
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Foto da máquina, uma arte antiga no estilo que você quer. Até 4 imagens, 4 MB cada — o Cérebro desenha em cima delas.
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={escrever} disabled={escrevendo || !tema.trim() || !temIA} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-agro-400 disabled:opacity-50">
              {escrevendo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Escrever com o Cérebro
            </button>
            <button onClick={desenhar} disabled={desenhando || !tema.trim() || !temImagem} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
              {desenhando ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Criar a arte
            </button>
            {(legenda || imagem) && (
              <button onClick={limpar} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">
                Começar outro
              </button>
            )}
          </div>
          {!temIA && <p className="mt-2 text-[11px] text-amber-600">Falta a chave GEMINI_API_KEY para o Cérebro escrever e desenhar.</p>}
          {temIA && !temImagem && <p className="mt-2 text-[11px] text-amber-600">A arte precisa de GEMINI_API_KEY (grátis) ou OPENAI_API_KEY; a legenda funciona com qualquer provedor.</p>}
          {erro && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
          {aviso && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{aviso}</p>}
        </div>

        {/* Prévia do post */}
        {(legenda || imagem) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Prévia</span>
              <span className={cn("text-[11px]", legenda.length > limite ? "font-bold text-red-600" : "text-slate-400")}>
                {legenda.length}/{limite}
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {imagem && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagem.url} alt="Arte do post" className="aspect-square w-full bg-slate-100 object-cover" />
              )}
              <div className="p-3">
                <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={6} className="w-full resize-y border-0 bg-transparent text-sm leading-relaxed text-slate-800 outline-none" />
                <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#hashtags" className="mt-1 w-full border-0 bg-transparent text-xs font-semibold text-sky-700 outline-none" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => salvar("pronto")} disabled={salvando || !legenda.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-agro-400 px-3 py-2 text-xs font-bold text-black disabled:opacity-50">
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar post
              </button>
              <button onClick={copiar} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                {copiado ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar texto"}
              </button>
              {imagem && (
                <a href={imagem.url} download={`post-${tipo}.png`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                  <Download size={14} /> Baixar a arte
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Posts salvos ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-black text-slate-800">Meus posts</span>
          <span className="text-[11px] text-slate-400">{posts.length}</span>
        </div>
        {posts.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum post ainda. Escolha um tipo, um tema e peça para o Cérebro escrever.</p>
        ) : (
          <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {posts.map((p) => {
              const Icone = ICONE_TIPO[p.tipo] ?? Megaphone;
              return (
                <li key={p.id} className="rounded-xl border border-slate-200 p-2.5">
                  <div className="flex gap-2">
                    {p.imagem ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagem} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><Icone size={18} /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-slate-800">{p.tema}</span>
                        {p.status === "publicado" && <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">PUBLICADO</span>}
                      </div>
                      <p className="line-clamp-2 text-[11px] leading-snug text-slate-500">{p.legenda}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button onClick={() => abrir(p)} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200">Abrir</button>
                    <button onClick={() => publicado(p)} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200">
                      {p.status === "publicado" ? "Desmarcar" : "Marquei publicado"}
                    </button>
                    <button onClick={() => mandarParaClientes(p)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200">
                      <Send size={11} /> Clientes
                    </button>
                    <button onClick={() => excluir(p.id)} className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-snug text-slate-400">
          Para mandar em massa com anexo, use a aba <Link href="/marketing?aba=mensagem" className="font-semibold text-brand-600 hover:underline">Mensagem para clientes</Link>.
        </p>
      </div>
    </div>
  );
}
