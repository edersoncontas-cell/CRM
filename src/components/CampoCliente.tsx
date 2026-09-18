"use client";

// Campo "Cliente" com busca de verdade: digita parte do nome e a lista filtra
// (sem acento, sem maiúscula, em ordem alfabética de gente). Se o cliente
// ainda não existe, dá para cadastrar ali mesmo pelo nome digitado, sem sair
// do formulário — o cadastro completo pode ser feito depois em Clientes.
//
// Funciona controlado (valor + aoMudar) ou dentro de um <form> comum (name):
// nesse caso guarda a escolha e manda o id num <input type="hidden">.

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { filtrarClientes, clienteComMesmoNome, type ClienteOpcao } from "@/lib/filtrar-clientes";
import { criarClienteRapidoAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function CampoCliente({
  clientes,
  valor,
  aoMudar,
  name,
  placeholder = "Digite o nome do cliente para buscar",
  className,
  permitirCriar = true,
  autoFoco = false,
}: {
  clientes: ClienteOpcao[];
  valor?: string;
  aoMudar?: (id: string, cliente: ClienteOpcao | null) => void;
  name?: string;
  placeholder?: string;
  className?: string;
  permitirCriar?: boolean;
  autoFoco?: boolean;
}) {
  const idLista = useId();
  const [interno, setInterno] = useState("");
  const idSel = valor ?? interno;
  const [extras, setExtras] = useState<ClienteOpcao[]>([]);
  const todos = useMemo(() => [...extras, ...clientes], [extras, clientes]);
  const selecionado = useMemo(() => todos.find((c) => c.id === idSel) ?? null, [todos, idSel]);
  const [texto, setTexto] = useState(() => selecionado?.nome ?? "");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(-1);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, startCriar] = useTransition();
  const caixa = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // Escolha vinda de fora (ex.: "Agendar visita" no Orientador já traz o cliente).
  useEffect(() => { if (selecionado) setTexto(selecionado.nome); }, [selecionado]);

  const sugestoes = useMemo(() => filtrarClientes(todos, selecionado && texto === selecionado.nome ? "" : texto), [todos, texto, selecionado]);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent | TouchEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("touchstart", fora); };
  }, [aberto]);

  useEffect(() => {
    if (destaque < 0) return;
    lista.current?.children[destaque]?.scrollIntoView({ block: "nearest" });
  }, [destaque]);

  function definir(c: ClienteOpcao | null) {
    const id = c?.id ?? "";
    if (valor === undefined) setInterno(id);
    aoMudar?.(id, c);
    setTexto(c?.nome ?? "");
    setAberto(false);
    setDestaque(-1);
    setErro(null);
  }

  function digitar(v: string) {
    setTexto(v);
    setAberto(true);
    setDestaque(-1);
    setErro(null);
    // Mudou o texto depois de escolher: a escolha cai até ele clicar em alguém de novo.
    if (selecionado && v !== selecionado.nome) {
      if (valor === undefined) setInterno("");
      aoMudar?.("", null);
    }
  }

  const nomeNovo = texto.trim();
  const jaExiste = clienteComMesmoNome(todos, nomeNovo);
  // Oferece o cadastro quando ninguém casa com o texto — ou quando ele já
  // digitou nome e sobrenome (aí é gente nova mesmo que haja parecidos).
  const podeCriar = permitirCriar && !selecionado && nomeNovo.length >= 2 && !jaExiste && (sugestoes.length === 0 || /\s/.test(nomeNovo));

  function criar() {
    if (!podeCriar) return;
    startCriar(async () => {
      const r = await criarClienteRapidoAction(nomeNovo);
      if (!r.ok || !r.id) { setErro(r.erro ?? "Não consegui cadastrar agora."); return; }
      const novo: ClienteOpcao = { id: r.id, nome: r.nome ?? nomeNovo, cidade: null };
      setExtras((x) => (x.some((c) => c.id === novo.id) ? x : [novo, ...x]));
      definir(novo);
    });
  }

  function teclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setAberto(false); setDestaque(-1); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!aberto) { setAberto(true); setDestaque(0); return; }
      if (sugestoes.length === 0) return;
      const passo = e.key === "ArrowDown" ? 1 : -1;
      setDestaque((d) => (d + passo + sugestoes.length) % sugestoes.length);
      return;
    }
    if (e.key === "Enter") {
      if (aberto && destaque >= 0 && sugestoes[destaque]) { e.preventDefault(); definir(sugestoes[destaque]); return; }
      if (aberto && sugestoes.length === 1) { e.preventDefault(); definir(sugestoes[0]); return; }
      if (podeCriar && sugestoes.length === 0) { e.preventDefault(); criar(); return; }
      if (aberto) e.preventDefault();
    }
  }

  return (
    <div ref={caixa} className="relative">
      {name && <input type="hidden" name={name} value={idSel} />}
      <div className="relative">
        <input
          ref={input}
          value={texto}
          onChange={(e) => digitar(e.target.value)}
          onFocus={() => setAberto(true)}
          onKeyDown={teclado}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFoco}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-autocomplete="list"
          className={cn(className, selecionado && "pr-16")}
        />
        {selecionado && (
          <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-emerald-600" title="Cliente escolhido"><Check size={15} /></span>
        )}
        {(texto || selecionado) && (
          <button type="button" onClick={() => { definir(null); input.current?.focus(); }} title="Limpar" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={14} />
          </button>
        )}
      </div>

      {aberto && (sugestoes.length > 0 || nomeNovo) && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {sugestoes.length > 0 ? (
            <ul id={idLista} ref={lista} className="max-h-56 overflow-y-auto py-1">
              {sugestoes.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => definir(c)}
                    onMouseEnter={() => setDestaque(i)}
                    className={cn("flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm", i === destaque ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50")}
                  >
                    <span className="min-w-0 truncate">{c.nome}</span>
                    {c.cidade && <span className="shrink-0 text-[11px] text-slate-400">{c.cidade}</span>}
                  </button>
                </li>
              ))}
              {todos.length > sugestoes.length && !nomeNovo && (
                <li className="px-3 py-1.5 text-[11px] text-slate-400">Mostrando {sugestoes.length} de {todos.length}. Digite para filtrar.</li>
              )}
            </ul>
          ) : (
            <p className="px-3 py-2 text-xs text-slate-500">Nenhum cliente com “{nomeNovo}”.</p>
          )}
          {podeCriar && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={criar}
              disabled={criando}
              className="flex w-full items-center gap-2 border-t border-slate-100 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
            >
              {criando ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              Cadastrar “{nomeNovo}” como cliente novo
            </button>
          )}
          {erro && <p className="border-t border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700">{erro}</p>}
        </div>
      )}
    </div>
  );
}
