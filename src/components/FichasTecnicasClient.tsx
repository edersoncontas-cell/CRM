"use client";

import { useRef, useState, useTransition } from "react";
import { salvarFichaTecnica, preencherFichaTecnicaIA, extrairFichaDeArquivo } from "@/lib/actions";
import { Pencil, X, Check, ChevronDown, ChevronUp, Sparkles, Paperclip } from "lucide-react";

type Maquina = {
  id: string;
  marca: string;
  modelo: string;
  categoria: string;
  proprio: boolean;
  potencia: number | null;
  pesoOperacional: number | null;
  descricao: string | null;
  especificacoes: string | null;
  pontosFortes: string | null;
  diferenciais: string | null;
  valorInicial: number | null;
  consumoLitrosHora: number | null;
  argumentos: string | null;
};

function brl(v: number | null) {
  return v == null ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Mescla especificações por atributo (não repete "Potência" de dois arquivos).
function mesclarSpecs(atual: string, novo: string): string {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const l of (atual + "\n" + novo).split("\n").map((s) => s.trim()).filter(Boolean)) {
    const chave = l.split(":")[0].toLowerCase().trim();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(l);
  }
  return out.join("\n");
}

// Junta listas separadas por ';' sem duplicar.
function juntarLista(a: string, b: string): string {
  const set = new Set([...a.split(";"), ...b.split(";")].map((s) => s.trim()).filter(Boolean));
  return Array.from(set).join("; ");
}

const CAT_LABEL: Record<string, string> = {
  miniescavadeira: "Mini Escavadeira",
  escavadeira: "Escavadeira",
  retroescavadeira: "Retroescavadeira",
  pacarregadeira: "Pá Carregadeira",
  motoniveladora: "Motoniveladora",
  tratoresteira: "Trator de Esteira",
  minicarregadeira: "Minicarregadeira",
  rolo_solo: "Rolo de Solo",
  rolo_tandem: "Rolo Tandem",
  rolo_pneumatico: "Rolo Pneumático",
  paver: "Vibroacabadora",
  alimentador: "Alimentador de Massa",
  fresadora: "Fresadora",
  leve: "Compactação Leve",
};

function EditModal({
  m,
  onClose,
  temChaveIA,
}: {
  m: Maquina;
  onClose: () => void;
  temChaveIA: boolean;
}) {
  const [specs, setSpecs] = useState(m.especificacoes ?? "");
  const [desc, setDesc] = useState(m.descricao ?? "");
  const [pontos, setPontos] = useState(m.pontosFortes ?? "");
  const [difs, setDifs] = useState(m.diferenciais ?? "");
  const [valor, setValor] = useState(m.valorInicial != null ? brl(m.valorInicial) : "");
  const [consumo, setConsumo] = useState(m.consumoLitrosHora != null ? String(m.consumoLitrosHora).replace(".", ",") : "");
  const [args, setArgs] = useState(m.argumentos ?? "");
  const [pending, start] = useTransition();
  const [preenchendo, startPreencher] = useTransition();
  const [lendoArquivo, startArquivo] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  // Limite prático de upload na Vercel é ~4.5MB por request — avisa ANTES de
  // enviar (arquivos de texto são sempre pequenos, usam teto menor).
  const LIMITE_MB = 4;
  const LIMITE_TEXTO_MB = 2;

  // Lê VÁRIOS arquivos (PDF, imagem, texto, HTML) e mescla as informações.
  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setAviso(null);
    startArquivo(async () => {
      let okCount = 0, lastErr = "";
      let accSpecs = specs, accDesc = desc, accPontos = pontos, accDifs = difs;
      for (const file of files) {
        const ehTexto = file.type.startsWith("text/") || /\.(txt|html?|md|csv)$/.test(file.name.toLowerCase());
        const limite = (ehTexto ? LIMITE_TEXTO_MB : LIMITE_MB) * 1024 * 1024;
        if (file.size > limite) {
          const tamanhoMb = (file.size / (1024 * 1024)).toFixed(1);
          lastErr = `Arquivo "${file.name}" tem ${tamanhoMb}MB — o limite é ${ehTexto ? LIMITE_TEXTO_MB : LIMITE_MB}MB. Comprima o PDF ou envie por partes.`;
          continue;
        }
        const fd = new FormData();
        fd.set("arquivo", file);
        const r = await extrairFichaDeArquivo(m.id, fd);
        if (!r.ok) { lastErr = r.erro ?? "falha"; continue; }
        okCount++;
        if (r.especificacoes) accSpecs = mesclarSpecs(accSpecs, r.especificacoes);
        if (r.descricao && !accDesc) accDesc = r.descricao;
        if (m.proprio && r.pontosFortes) accPontos = juntarLista(accPontos, r.pontosFortes);
        if (m.proprio && r.diferenciais) accDifs = juntarLista(accDifs, r.diferenciais);
        if (r.consumoLitrosHora) setConsumo(String(r.consumoLitrosHora).replace(".", ","));
        if (m.proprio && r.valorInicial) setValor(brl(r.valorInicial));
      }
      setSpecs(accSpecs); setDesc(accDesc); setPontos(accPontos); setDifs(accDifs);
      if (arquivoRef.current) arquivoRef.current.value = "";
      setAviso(okCount ? `Li ${okCount} arquivo(s) — confira os números e salve. ✓` : (lastErr || "Não consegui ler os arquivos."));
    });
  }

  function preencherComIA() {
    setAviso(null);
    startPreencher(async () => {
      const r = await preencherFichaTecnicaIA(m.id);
      if (!r.ok) {
        setAviso(r.erro ?? "Não foi possível preencher.");
        return;
      }
      // Só preenche o que veio e não sobrescreve o que você já tinha digitado à toa:
      if (r.especificacoes) setSpecs(r.especificacoes);
      if (r.descricao) setDesc(r.descricao);
      if (m.proprio && r.pontosFortes) setPontos(r.pontosFortes);
      if (m.proprio && r.diferenciais) setDifs(r.diferenciais);
      setAviso("Preenchido pela IA — confira os números e salve. ✓");
    });
  }

  function salvar() {
    start(async () => {
      await salvarFichaTecnica(m.id, {
        especificacoes: specs || undefined,
        descricao: desc || undefined,
        pontosFortes: pontos || undefined,
        diferenciais: difs || undefined,
        valorInicial: valor ? Number(valor.replace(/[^\d]/g, "")) || null : null,
        consumoLitrosHora: consumo ? Number(consumo.replace(",", ".")) || null : null,
        argumentos: args || undefined,
      });
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl"
        style={{ background: "#18181b", border: "1px solid #3f3f46" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs font-semibold mb-0.5" style={{ color: m.proprio && m.marca === "New Holland" ? "#BFDE4D" : m.proprio ? "#60a5fa" : "#a1a1aa" }}>
              {m.marca}
            </div>
            <h2 className="text-xl font-bold text-white">{m.modelo}</h2>
            <p className="text-xs text-zinc-400">{CAT_LABEL[m.categoria] ?? m.categoria}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-700 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={preencherComIA}
            disabled={preenchendo || lendoArquivo}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-60"
            style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }}
          >
            <Sparkles size={15} />
            {preenchendo ? "Buscando com a IA..." : "Preencher com IA"}
          </button>
          <button
            onClick={() => arquivoRef.current?.click()}
            disabled={lendoArquivo || preenchendo}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-60"
            style={{ background: "rgba(191,222,77,0.12)", color: "#BFDE4D", border: "1px solid rgba(191,222,77,0.3)" }}
          >
            <Paperclip size={15} />
            {lendoArquivo ? "Lendo arquivos..." : "Anexar arquivos (PDF/foto/texto)"}
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept="application/pdf,image/*,text/plain,text/html,.txt,.html,.htm,.md,.csv"
            multiple
            onChange={aoEscolherArquivo}
            className="hidden"
          />
        </div>
        <p className="mb-2 -mt-1 text-[11px] text-zinc-500">
          📎 Anexe datasheet, folheto, comparativo ou foto da ficha (PDF, imagem, texto ou HTML) — pode mandar
          <b> vários de uma vez</b>. A IA lê, extrai e <b>mescla</b> os dados (só o que estiver no arquivo, sem inventar). O arquivo não é guardado.
        </p>
        {!temChaveIA && (
          <p className="mb-3 -mt-0.5 text-[11px] rounded-lg px-3 py-2" style={{ color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
            ⚠️ <b>PDF e imagens</b> exigem <code>GEMINI_API_KEY</code>, <code>OPENAI_API_KEY</code> ou <code>ANTHROPIC_API_KEY</code> — configure em <b>Configurações → Integrações</b>. Arquivos de texto e HTML funcionam normalmente.
          </p>
        )}
        {aviso && (
          <p
            className="mb-4 -mt-1 text-xs rounded-lg px-3 py-2"
            style={{
              color: aviso.includes("✓") ? "#4ade80" : "#f87171",
              background: aviso.includes("✓") ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
              border: `1px solid ${aviso.includes("✓") ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
            }}
          >
            {aviso}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Especificações Técnicas
              <span className="ml-2 text-zinc-500 font-normal">(uma por linha — ex: Potência: 158 cv)</span>
            </label>
            <textarea
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              rows={8}
              placeholder={"Potência: 158 cv\nPeso operacional: 21.500 kg\nCapacidade de balde: 1,1 – 1,7 m³\nForça de escavação: 142 kN\nProfundidade máx. de escavação: 6.460 mm\nAltura máx. de escavação: 9.455 mm"}
              className="w-full rounded-xl p-3 text-sm text-white font-mono resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
              style={{ background: "#09090b", border: "1px solid #3f3f46" }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Descrição geral</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="Breve descrição da máquina e uso principal"
              className="w-full rounded-xl p-3 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
              style={{ background: "#09090b", border: "1px solid #3f3f46" }}
            />
          </div>

          {/* Banco de Negociação */}
          <div className="rounded-xl p-3" style={{ background: "rgba(191,222,77,0.06)", border: "1px solid rgba(191,222,77,0.25)" }}>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold" style={{ color: "#BFDE4D" }}>
              💼 Banco de Negociação
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {m.proprio && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Valor inicial ao cliente (R$)</label>
                  <input
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    inputMode="numeric"
                    placeholder="Ex: 850.000"
                    className="w-full rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    style={{ background: "#09090b", border: "1px solid #3f3f46" }}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Consumo diesel (L/h) <span className="font-normal text-zinc-500">— p/ comparativo</span>
                </label>
                <input
                  value={consumo}
                  onChange={(e) => setConsumo(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ex: 14,5"
                  className="w-full rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  style={{ background: "#09090b", border: "1px solid #3f3f46" }}
                />
              </div>
            </div>
            {m.proprio && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Argumentos / condições de negociação</label>
                <textarea
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  rows={3}
                  placeholder="Ex: Entrada facilitada; bônus na troca; condição especial à vista; prazo de entrega; garantia estendida…"
                  className="w-full rounded-xl p-3 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  style={{ background: "#09090b", border: "1px solid #3f3f46" }}
                />
              </div>
            )}
          </div>

          {m.proprio && (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Pontos Fortes (argumentos de venda)</label>
                <textarea
                  value={pontos}
                  onChange={(e) => setPontos(e.target.value)}
                  rows={3}
                  placeholder="Ex: Motor FPT econômico; cabine ROPS; câmera de ré; excelente revenda"
                  className="w-full rounded-xl p-3 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  style={{ background: "#09090b", border: "1px solid #3f3f46" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Diferenciais</label>
                <textarea
                  value={difs}
                  onChange={(e) => setDifs(e.target.value)}
                  rows={3}
                  placeholder="Ex: Rede nacional de peças; custo por m³ competitivo; tradição New Holland"
                  className="w-full rounded-xl p-3 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  style={{ background: "#09090b", border: "1px solid #3f3f46" }}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-400 hover:bg-zinc-700"
          >
            Cancelar
          </button>
          <button
            disabled={pending}
            onClick={salvar}
            className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-black disabled:opacity-60"
            style={{ background: "#BFDE4D" }}
          >
            <Check size={15} />
            {pending ? "Salvando..." : "Salvar ficha"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MaquinaRow({ m, temChaveIA }: { m: Maquina; temChaveIA: boolean }) {
  const [editando, setEditando] = useState(false);
  const [expandida, setExpandida] = useState(false);
  const temEspec = !!m.especificacoes?.trim();

  return (
    <>
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3 mb-2 transition-all"
        style={{
          background: "#18181b",
          border: `1px solid ${temEspec ? "#3f3f46" : "#27272a"}`,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{
              background: m.proprio && m.marca === "New Holland"
                ? "rgba(191,222,77,0.15)"
                : m.proprio
                ? "rgba(96,165,250,0.15)"
                : "rgba(161,161,170,0.1)",
              color: m.proprio && m.marca === "New Holland"
                ? "#BFDE4D"
                : m.proprio
                ? "#60a5fa"
                : "#a1a1aa",
            }}
          >
            {m.marca}
          </div>
          <div>
            <div className="text-sm font-bold text-white">{m.modelo}</div>
            <div className="text-xs text-zinc-500">{CAT_LABEL[m.categoria] ?? m.categoria}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {temEspec && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <Check size={11} /> Ficha ok
            </span>
          )}
          {temEspec && (
            <button
              onClick={() => setExpandida((v) => !v)}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              title={expandida ? "Recolher" : "Ver especificações"}
            >
              {expandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
            title="Editar ficha técnica"
          >
            <Pencil size={13} /> Editar
          </button>
        </div>
      </div>

      {expandida && temEspec && (
        <div
          className="rounded-xl px-4 py-3 mb-2 ml-2 font-mono text-xs text-zinc-300 whitespace-pre-wrap"
          style={{ background: "#09090b", border: "1px solid #27272a" }}
        >
          {m.especificacoes}
        </div>
      )}

      {editando && <EditModal m={m} onClose={() => setEditando(false)} temChaveIA={temChaveIA} />}
    </>
  );
}

export function FichasTecnicasClient({ maquinas, temChaveIA }: { maquinas: Maquina[]; temChaveIA: boolean }) {
  const [filtro, setFiltro] = useState<"todas" | "minhas" | "concorrentes">("minhas");
  const [marca, setMarca] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const marcasDisponiveis = Array.from(new Set(
    maquinas
      .filter((m) => filtro === "minhas" ? m.proprio : filtro === "concorrentes" ? !m.proprio : true)
      .map((m) => m.marca)
  )).sort();

  function mudarFiltro(novo: "todas" | "minhas" | "concorrentes") {
    setFiltro(novo);
    setMarca(null);
  }

  const lista = maquinas.filter((m) => {
    if (filtro === "minhas" && !m.proprio) return false;
    if (filtro === "concorrentes" && m.proprio) return false;
    if (marca && m.marca !== marca) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return m.modelo.toLowerCase().includes(q) || m.marca.toLowerCase().includes(q) || m.categoria.toLowerCase().includes(q);
    }
    return true;
  });

  const comFicha = maquinas.filter((m) => m.proprio && m.especificacoes?.trim()).length;
  const totalProprias = maquinas.filter((m) => m.proprio).length;

  return (
    <div>
      <div className="mb-6 rounded-xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
        <div className="text-sm text-zinc-300">
          <span className="font-bold text-white">{comFicha}</span>
          <span className="text-zinc-500"> / {totalProprias} máquinas próprias com ficha técnica preenchida</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${totalProprias ? (comFicha / totalProprias) * 100 : 0}%`, background: "#BFDE4D" }}
          />
        </div>
      </div>

      {marcasDisponiveis.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500">Marca:</span>
          <button
            onClick={() => setMarca(null)}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
            style={{ background: marca === null ? "#BFDE4D" : "#3f3f46", color: marca === null ? "#000" : "#fff", border: marca === null ? "1px solid #BFDE4D" : "1px solid #52525b" }}
          >
            Todas
          </button>
          {marcasDisponiveis.map((ma) => (
            <button
              key={ma}
              onClick={() => setMarca(ma)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
              style={{ background: marca === ma ? "#BFDE4D" : "transparent", color: marca === ma ? "#000" : "#a1a1aa", border: marca === ma ? "1px solid #BFDE4D" : "1px solid #3f3f46" }}
            >
              {ma}
            </button>
          ))}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-3 items-center">
        <div className="flex rounded-xl overflow-hidden border border-zinc-700">
          {(["minhas", "concorrentes", "todas"] as const).map((f) => (
            <button
              key={f}
              onClick={() => mudarFiltro(f)}
              className="px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                background: filtro === f ? "#27272a" : "transparent",
                color: filtro === f ? "#fff" : "#71717a",
              }}
            >
              {f === "minhas" ? "Minhas" : f === "concorrentes" ? "Concorrentes" : "Todas"}
            </button>
          ))}
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar modelo..."
          className="rounded-xl px-3 py-2 text-sm text-white flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          style={{ background: "#18181b", border: "1px solid #3f3f46" }}
        />
      </div>

      <div>
        {lista.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center">Nenhuma máquina encontrada.</p>
        ) : (
          lista.map((m) => <MaquinaRow key={m.id} m={m} temChaveIA={temChaveIA} />)
        )}
      </div>
    </div>
  );
}
