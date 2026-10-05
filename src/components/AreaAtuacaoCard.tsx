"use client";

// Configurações → Área de atuação (05/10). Os municípios que o vendedor
// atende — vale para o CRM inteiro. Por enquanto só o ES: com um estado só
// liberado, a escolha de estado some e fica o nome dele. Regras e sincronia
// com o banco: lib/area-atuacao*.ts.

import { useMemo, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { listarMunicipiosDaUfAction, salvarAreaAtuacaoAction } from "@/lib/area-atuacao-actions";
import { MapPin, Loader2, Save, X, Search, CheckCircle2, AlertTriangle, Plus } from "lucide-react";

type Estado = { uf: string; nome: string };
type Props = {
  estados: Estado[];
  inicial: { configurada: boolean; ufs: string[]; marcados: { uf: string; nome: string }[]; listas: Record<string, string[]>; atualizadoEm: string | null; foraDaLista: string[] };
};
type Resumo = { estados: string[]; atende: number; novas: number; passaramParaFora: number; voltaramParaDentro: number; clientesForaAgora: number; ficaramComoEstavam: string[] };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chave = (uf: string, nome: string) => `${uf}:${nome}`;

export function AreaAtuacaoCard({ estados, inicial }: Props) {
  const [ufs, setUfs] = useState<string[]>(inicial.ufs);
  const [listas, setListas] = useState<Record<string, string[]>>(inicial.listas);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(inicial.marcados.map((m) => chave(m.uf, m.nome))));
  const [aberta, setAberta] = useState<string>(inicial.ufs[0] ?? "");
  const [busca, setBusca] = useState("");
  const [soMarcados, setSoMarcados] = useState(false);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [erroLista, setErroLista] = useState<{ uf: string; texto: string } | null>(null);
  const [mudou, setMudou] = useState(false);
  const [resultado, setResultado] = useState<{ ok: true; resumo: Resumo } | { ok: false; erro: string } | null>(null);
  const [salvando, start] = useTransition();
  const resultadoRef = useRef<HTMLDivElement>(null);

  const nomeUf = (uf: string) => estados.find((e) => e.uf === uf)?.nome ?? uf;
  const contagem = (uf: string) => Array.from(marcados).filter((k) => k.startsWith(`${uf}:`)).length;
  const total = marcados.size;

  async function carregarLista(uf: string) {
    setErroLista(null);
    setCarregando(uf);
    try {
      const r = await listarMunicipiosDaUfAction(uf);
      if (r.ok) setListas((l) => ({ ...l, [uf]: r.nomes }));
      else setErroLista({ uf, texto: r.erro });
    } catch {
      setErroLista({ uf, texto: "Sem resposta do servidor. Confira a internet e tente de novo." });
    } finally {
      setCarregando(null);
    }
  }

  function adicionarUf(uf: string) {
    if (!uf || ufs.includes(uf)) return;
    setUfs((u) => [...u, uf]);
    setAberta(uf);
    setBusca("");
    setMudou(true);
    setResultado(null);
    if (!listas[uf]) carregarLista(uf);
  }

  function tirarUf(uf: string) {
    setUfs((u) => u.filter((x) => x !== uf));
    setMarcados((m) => new Set(Array.from(m).filter((k) => !k.startsWith(`${uf}:`))));
    if (aberta === uf) setAberta(ufs.find((x) => x !== uf) ?? "");
    setMudou(true);
    setResultado(null);
  }

  const visiveis = useMemo(() => {
    const lista = listas[aberta] ?? [];
    const b = semAcento(busca.trim());
    return lista.filter((n) => (!b || semAcento(n).includes(b)) && (!soMarcados || marcados.has(chave(aberta, n))));
  }, [listas, aberta, busca, soMarcados, marcados]);

  function alternar(nome: string) {
    setMarcados((m) => {
      const n = new Set(m);
      const k = chave(aberta, nome);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
    setMudou(true);
    setResultado(null);
  }

  function marcarVisiveis(marcar: boolean) {
    setMarcados((m) => {
      const n = new Set(m);
      for (const nome of visiveis) { const k = chave(aberta, nome); if (marcar) n.add(k); else n.delete(k); }
      return n;
    });
    setMudou(true);
    setResultado(null);
  }

  function salvar() {
    setResultado(null);
    const municipios = Array.from(marcados).map((k) => { const i = k.indexOf(":"); return { uf: k.slice(0, i), nome: k.slice(i + 1) }; });
    start(async () => {
      try {
        const r = await salvarAreaAtuacaoAction({ ufs, municipios });
        setResultado(r);
        if (r.ok) setMudou(false);
      } catch {
        setResultado({ ok: false, erro: "Sem resposta do servidor — nada foi salvo. Confira a internet e tente de novo." });
      }
      setTimeout(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    });
  }

  const podeEscolherEstado = estados.length > 1;
  const faltaMunicipio = ufs.filter((uf) => contagem(uf) === 0);
  const podeSalvar = ufs.length > 0 && faltaMunicipio.length === 0 && !salvando;

  return (
    <Card className="mb-6">
      <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <MapPin size={18} className="text-brand-600" /> Área de atuação
      </div>
      <p className="mb-3 text-sm text-slate-500">
        As cidades que você atende. Vale para o CRM inteiro: o mapa do Dashboard e de Visitas, as cidades sugeridas
        nas visitas, as licitações que o CRM procura, o envio de mensagem &quot;para todos&quot;, a lista &quot;Cidades que
        atendo&quot; e as cidades que a IA grava no cadastro.
      </p>
      {!inicial.configurada && (
        <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Ainda não salva: o CRM está usando a área de sempre. Já deixei marcadas as cidades que hoje aparecem como
          &quot;cidades que atendo&quot; — confira e salve.
        </p>
      )}

      {/* Estados — só aparece a escolha quando há mais de um liberado. */}
      {!podeEscolherEstado ? (
        <p className="mb-3 text-sm text-slate-600">Estado: <b>{ufs.map(nomeUf).join(", ") || nomeUf(estados[0]?.uf ?? "")}</b></p>
      ) : (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {ufs.map((uf) => (
          <span key={uf} className={`inline-flex items-center gap-1 rounded-full border py-1 pl-3 pr-1 text-sm ${aberta === uf ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600"}`}>
            <button type="button" onClick={() => { setAberta(uf); setBusca(""); }} className="font-semibold">
              {nomeUf(uf)} <span className="text-xs font-normal text-slate-500">({contagem(uf)})</span>
            </button>
            <button type="button" onClick={() => tirarUf(uf)} aria-label={`Tirar ${nomeUf(uf)}`} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600">
              <X size={14} />
            </button>
          </span>
        ))}
        <label className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-1 text-sm text-slate-500">
          <Plus size={14} />
          <select
            value=""
            onChange={(e) => adicionarUf(e.target.value)}
            className="bg-transparent text-sm outline-none"
            aria-label="Adicionar estado"
          >
            <option value="">{ufs.length ? "Adicionar estado" : "Escolha o estado"}</option>
            {estados.filter((e) => !ufs.includes(e.uf)).map((e) => (
              <option key={e.uf} value={e.uf}>{e.nome}</option>
            ))}
          </select>
        </label>
      </div>
      )}

      {ufs.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Escolha pelo menos um estado para marcar as cidades.</p>
      ) : (
        <div className="rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-2">
            {/* No celular a busca ocupa a linha inteira; os botões descem. */}
            <div className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={podeEscolherEstado ? `Buscar cidade (${aberta})` : "Buscar cidade"}
                className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <button type="button" onClick={() => marcarVisiveis(true)} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">Marcar {busca ? "estas" : "todas"}</button>
            <button type="button" onClick={() => marcarVisiveis(false)} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">Desmarcar {busca ? "estas" : "todas"}</button>
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input type="checkbox" checked={soMarcados} onChange={(e) => setSoMarcados(e.target.checked)} /> só as marcadas
            </label>
          </div>
          <div className="px-2 pt-1 text-[11px] text-slate-500">
            {contagem(aberta)} de {(listas[aberta] ?? []).length || "…"} cidades marcadas{podeEscolherEstado ? ` (${aberta})` : ""}
          </div>
          {/* Lista com altura fixa e rolagem própria: ele usa no celular. */}
          <div className="h-64 overflow-y-auto p-1">
            {carregando === aberta ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Carregando as cidades…</div>
            ) : erroLista?.uf === aberta ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-red-700">
                <span><AlertTriangle size={14} className="mr-1 inline" />{erroLista.texto}</span>
                <button type="button" onClick={() => carregarLista(aberta)} className="rounded-lg bg-white px-3 py-1 text-xs font-semibold ring-1 ring-slate-300">Tentar de novo</button>
              </div>
            ) : visiveis.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
                {soMarcados ? "Nenhuma cidade marcada neste estado." : `Nenhuma cidade com "${busca}".`}
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
                {visiveis.map((nome) => {
                  const on = marcados.has(chave(aberta, nome));
                  return (
                    <li key={nome}>
                      <label className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${on ? "font-semibold text-slate-800" : "text-slate-600"} hover:bg-slate-50`}>
                        <input type="checkbox" checked={on} onChange={() => alternar(nome)} className="h-4 w-4 shrink-0 accent-brand-600" />
                        <span className="truncate">{nome}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {inicial.foraDaLista.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Também estão como &quot;atendo&quot; no CRM, mas não são município na lista do IBGE (distrito ou nome escrito de outro
          jeito) — salvar não mexe nelas: {inicial.foraDaLista.join(", ")}.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={!podeSalvar}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar área
        </button>
        <span className="text-xs text-slate-500">
          {total} cidade{total === 1 ? "" : "s"}{podeEscolherEstado ? ` em ${ufs.length} estado${ufs.length === 1 ? "" : "s"}` : ""}
          {mudou && <b className="ml-1 text-amber-700">· alterações não salvas</b>}
        </span>
      </div>
      {faltaMunicipio.length > 0 && ufs.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">{podeEscolherEstado ? `Marque pelo menos uma cidade em ${faltaMunicipio.join(", ")} — ou tire o estado da lista.` : "Marque pelo menos uma cidade para salvar."}</p>
      )}

      <div ref={resultadoRef}>
        {resultado && !resultado.ok && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {resultado.erro}
          </p>
        )}
        {resultado?.ok && (
          <div role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <div className="flex items-center gap-1.5 font-semibold"><CheckCircle2 size={15} /> Área salva: {resultado.resumo.atende} cidade{resultado.resumo.atende === 1 ? "" : "s"}{podeEscolherEstado ? ` em ${resultado.resumo.estados.map(nomeUf).join(", ")}` : ""}.</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {resultado.resumo.novas > 0 && <li>{resultado.resumo.novas} cidade{resultado.resumo.novas === 1 ? "" : "s"} nova{resultado.resumo.novas === 1 ? "" : "s"} no CRM, já com lugar no mapa.</li>}
              {resultado.resumo.voltaramParaDentro > 0 && <li>{resultado.resumo.voltaramParaDentro} cidade{resultado.resumo.voltaramParaDentro === 1 ? "" : "s"} voltou para &quot;cidades que atendo&quot;.</li>}
              {resultado.resumo.passaramParaFora > 0 && (
                <li>
                  {resultado.resumo.passaramParaFora} cidade{resultado.resumo.passaramParaFora === 1 ? "" : "s"} passou para &quot;fora da minha área&quot;
                  {resultado.resumo.clientesForaAgora > 0 && <> — {resultado.resumo.clientesForaAgora} cliente{resultado.resumo.clientesForaAgora === 1 ? "" : "s"} dela{resultado.resumo.passaramParaFora === 1 ? "" : "s"} saem do envio &quot;para todos&quot;; nenhum dado é apagado</>}.
                </li>
              )}
              {resultado.resumo.ficaramComoEstavam.length > 0 && <li>{resultado.resumo.ficaramComoEstavam.length} nome{resultado.resumo.ficaramComoEstavam.length === 1 ? "" : "s"} fora da lista do IBGE continua{resultado.resumo.ficaramComoEstavam.length === 1 ? "" : "m"} como estava{resultado.resumo.ficaramComoEstavam.length === 1 ? "" : "m"}: {resultado.resumo.ficaramComoEstavam.join(", ")}.</li>}
              <li>O mapa do Dashboard e o de Visitas já abrem nesta área.</li>
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
