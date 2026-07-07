"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { preencherAplicacoesMaquinaIA, salvarAplicacoesMaquina } from "@/lib/actions";
import { Sparkles, Pencil, Check, X, Search, Layers } from "lucide-react";

type Maquina = {
  id: string;
  marca: string;
  modelo: string;
  categoria: string;
  aplicacoes: string | null;
};

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
  paver: "Paver",
  leve: "Leve",
};

// Converte **negrito** inline em <strong>, sem depender de lib de markdown —
// usado nos rótulos "Aplicação:"/"Diferencial competitivo:" do dossiê gerado.
function renderInlineBold(texto: string, keyBase: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((parte, i) =>
    parte.startsWith("**") && parte.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`} className="font-semibold text-slate-800">{parte.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyBase}-${i}`}>{parte}</span>
    )
  );
}

// Renderização leve do texto gerado (## segmento, - bullet, **negrito**) sem
// dependência de biblioteca de markdown — o formato é sempre o mesmo (ver
// prompt em lib/ai). A seção "Resumo executivo" ganha um destaque visual à
// parte, como abertura de um dossiê técnico-comercial.
function RenderAplicacoes({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i].trim();
    if (!l) { i++; continue; }
    if (l.toLowerCase() === "## resumo executivo") {
      const paragrafo: string[] = [];
      i++;
      while (i < linhas.length && !linhas[i].trim().startsWith("## ")) {
        if (linhas[i].trim()) paragrafo.push(linhas[i].trim());
        i++;
      }
      nodes.push(
        <div key="resumo" className="mb-4 rounded-lg border border-brand-100 bg-brand-50/60 p-3 text-sm leading-relaxed text-slate-700">
          {renderInlineBold(paragrafo.join(" "), "resumo")}
        </div>
      );
      continue;
    }
    if (l.startsWith("## ")) {
      nodes.push(<div key={i} className="mt-3 mb-1 text-sm font-bold text-brand-700 first:mt-0">{l.slice(3)}</div>);
      i++;
      continue;
    }
    if (l.startsWith("- ")) {
      nodes.push(<div key={i} className="ml-1 text-sm leading-relaxed text-slate-600">• {renderInlineBold(l.slice(2), `l${i}`)}</div>);
      i++;
      continue;
    }
    nodes.push(<div key={i} className="text-sm text-slate-600">{renderInlineBold(l, `p${i}`)}</div>);
    i++;
  }
  return <div className="space-y-0.5">{nodes}</div>;
}

function MaquinaCard({ m }: { m: Maquina }) {
  const [aplicacoes, setAplicacoes] = useState(m.aplicacoes ?? "");
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(aplicacoes);
  const [gerando, startGerar] = useTransition();
  const [salvando, startSalvar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function gerarComIA() {
    setErro(null);
    startGerar(async () => {
      const r = await preencherAplicacoesMaquinaIA(m.id);
      if (!r.ok || !r.aplicacoes) {
        setErro(r.erro ?? "Não foi possível gerar agora.");
        return;
      }
      setRascunho(r.aplicacoes);
      setEditando(true);
    });
  }

  function salvar() {
    startSalvar(async () => {
      await salvarAplicacoesMaquina(m.id, rascunho);
      setAplicacoes(rascunho);
      setEditando(false);
    });
  }

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-400">{m.marca}</div>
          <div className="text-lg font-bold text-slate-800">{m.modelo}</div>
          <div className="text-xs text-slate-500">{CAT_LABEL[m.categoria] ?? m.categoria}</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {!editando && (
            <button
              onClick={() => { setRascunho(aplicacoes); setEditando(true); }}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
              title="Editar manualmente"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={gerarComIA}
            disabled={gerando}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Sparkles size={13} /> {gerando ? "Gerando…" : aplicacoes ? "Atualizar com IA" : "Gerar com IA"}
          </button>
        </div>
      </div>

      {erro && <p className="mb-2 text-xs font-semibold text-red-600">{erro}</p>}

      {editando ? (
        <div>
          <textarea
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            rows={14}
            className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs leading-relaxed outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            placeholder={"## Construção civil\n- Operação — por que se encaixa\n\n## Nichos pouco explorados\n- ..."}
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => setEditando(false)} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <X size={13} /> Cancelar
            </button>
            <button onClick={salvar} disabled={salvando} className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-60">
              <Check size={13} /> {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      ) : aplicacoes ? (
        <RenderAplicacoes texto={aplicacoes} />
      ) : (
        <p className="text-sm text-slate-400">Ainda sem aplicações mapeadas — clique em &quot;Gerar com IA&quot;.</p>
      )}
    </Card>
  );
}

export function AplicacoesClient({ maquinas }: { maquinas: Maquina[] }) {
  const [busca, setBusca] = useState("");
  const [marcaSel, setMarcaSel] = useState("");
  const [modeloSel, setModeloSel] = useState("");

  const marcas = Array.from(new Set(maquinas.map((m) => m.marca))).sort();
  const modelos = Array.from(
    new Set(maquinas.filter((m) => !marcaSel || m.marca === marcaSel).map((m) => m.modelo))
  ).sort();

  const filtradas = maquinas.filter((m) => {
    if (marcaSel && m.marca !== marcaSel) return false;
    if (modeloSel && m.modelo !== modeloSel) return false;
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      m.modelo.toLowerCase().includes(q) ||
      m.marca.toLowerCase().includes(q) ||
      (CAT_LABEL[m.categoria] ?? m.categoria).toLowerCase().includes(q) ||
      (m.aplicacoes ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nicho, segmento ou modelo (ex: agricultura, mineração)…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <select
          value={marcaSel}
          onChange={(e) => { setMarcaSel(e.target.value); setModeloSel(""); }}
          className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        >
          <option value="">Todas as marcas</option>
          {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={modeloSel}
          onChange={(e) => setModeloSel(e.target.value)}
          className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        >
          <option value="">Todos os modelos</option>
          {modelos.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-14 text-center">
          <Layers size={28} className="mb-3 text-slate-300" />
          <p className="font-semibold text-slate-600">Nenhuma máquina encontrada para &quot;{busca}&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtradas.map((m) => <MaquinaCard key={m.id} m={m} />)}
        </div>
      )}
    </div>
  );
}
