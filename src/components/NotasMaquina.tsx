"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { criarNotaMaquina, editarNotaMaquina, excluirNotaMaquina } from "@/lib/actions";
import { BookOpen, Pencil, Trash2, Check, X } from "lucide-react";

type MaquinaOpt = { id: string; marca: string; modelo: string };
type Nota = { id: string; maquinaId: string; concorrenteId: string | null; texto: string; criadoEm: string };

function agruparPorMarca(maquinas: MaquinaOpt[]): Record<string, MaquinaOpt[]> {
  const grupos: Record<string, MaquinaOpt[]> = {};
  for (const m of maquinas) (grupos[m.marca] ??= []).push(m);
  return grupos;
}

// "Meu conhecimento" (Comparativo 2.0, item J.4): notas do vendedor sobre uma
// máquina própria, opcionalmente contra um concorrente específico. Alimenta o
// resumo de diferenciais, o comparativo completo e o contexto do Cérebro.
export function NotasMaquina({
  minhas,
  concorrentes,
  notasIniciais,
  minhaAtualId,
}: {
  minhas: MaquinaOpt[];
  concorrentes: MaquinaOpt[];
  notasIniciais: Nota[];
  minhaAtualId: string;
}) {
  const [notas, setNotas] = useState(notasIniciais);
  const [minhaId, setMinhaId] = useState(minhaAtualId);
  const [concorrenteId, setConcorrenteId] = useState("");
  const [texto, setTexto] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState("");
  const [pending, startTransition] = useTransition();

  const gruposMinhas = useMemo(() => agruparPorMarca(minhas), [minhas]);
  const gruposConcorrentes = useMemo(() => agruparPorMarca(concorrentes), [concorrentes]);

  const nome = (id: string | null, lista: MaquinaOpt[]) => {
    if (!id) return null;
    const m = lista.find((x) => x.id === id);
    return m ? `${m.marca} ${m.modelo}` : null;
  };

  const notasDaMaquina = notas.filter((n) => n.maquinaId === minhaId);

  function salvar() {
    const t = texto.trim();
    if (!t || !minhaId) return;
    const fd = new FormData();
    fd.set("maquinaId", minhaId);
    if (concorrenteId) fd.set("concorrenteId", concorrenteId);
    fd.set("texto", t);
    startTransition(async () => {
      await criarNotaMaquina(fd);
      setNotas((ns) => [{ id: `tmp-${Date.now()}`, maquinaId: minhaId, concorrenteId: concorrenteId || null, texto: t, criadoEm: new Date().toISOString() }, ...ns]);
      setTexto("");
      setConcorrenteId("");
    });
  }

  function iniciarEdicao(n: Nota) {
    setEditandoId(n.id);
    setTextoEdicao(n.texto);
  }

  function salvarEdicao(id: string) {
    const t = textoEdicao.trim();
    if (!t) return;
    setNotas((ns) => ns.map((n) => (n.id === id ? { ...n, texto: t } : n)));
    setEditandoId(null);
    startTransition(async () => {
      await editarNotaMaquina(id, t);
    });
  }

  function excluir(id: string) {
    setNotas((ns) => ns.filter((n) => n.id !== id));
    startTransition(async () => {
      await excluirNotaMaquina(id);
    });
  }

  return (
    <Card className="mb-6 print:hidden">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <BookOpen size={18} className="text-violet-600" /> Meu conhecimento
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Registre observações reais (ex.: consumo, manutenção, defeitos comuns) que você já viu na prática — alimenta o resumo de
        diferenciais, o comparativo completo e o Cérebro.
      </p>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Minha máquina</label>
          <select value={minhaId} onChange={(e) => setMinhaId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500">
            {Object.entries(gruposMinhas).map(([marca, ms]) => (
              <optgroup key={marca} label={marca}>
                {ms.map((m) => <option key={m.id} value={m.id}>{m.modelo}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Concorrente (opcional)</label>
          <select value={concorrenteId} onChange={(e) => setConcorrenteId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500">
            <option value="">— Nota geral —</option>
            {Object.entries(gruposConcorrentes).map(([marca, ms]) => (
              <optgroup key={marca} label={marca}>
                {ms.map((m) => <option key={m.id} value={m.id}>{m.modelo}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        placeholder="Ex: CAT 316 consome 4L/h a mais que minha E145C e a manutenção é ~10% mais cara"
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
      <button
        onClick={salvar}
        disabled={pending || !texto.trim()}
        className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        Salvar nota
      </button>

      {notasDaMaquina.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          {notasDaMaquina.map((n) => (
            <li key={n.id} className="rounded-lg bg-slate-50 p-2.5 text-sm">
              {editandoId === n.id ? (
                <div className="space-y-1.5">
                  <textarea
                    value={textoEdicao}
                    onChange={(e) => setTextoEdicao(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => salvarEdicao(n.id)} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                      <Check size={12} /> Salvar
                    </button>
                    <button onClick={() => setEditandoId(null)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                      <X size={12} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {n.concorrenteId && (
                      <div className="mb-0.5 text-xs font-bold text-red-600">vs {nome(n.concorrenteId, concorrentes) ?? "concorrente"}</div>
                    )}
                    <p className="text-slate-700">{n.texto}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => iniciarEdicao(n)} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" title="Editar">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => excluir(n.id)} className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600" title="Excluir">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
