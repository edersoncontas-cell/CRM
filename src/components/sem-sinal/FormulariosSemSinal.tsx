"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Handshake, Loader2, X } from "lucide-react";
import {
  colunasParaNovaNegociacao, formatarReais, lerValorBR, novoId,
  type ClienteVista, type ColunaPacote, type MaquinaPacote, type OpAgendarVisita, type OpCriarNegociacao,
} from "@/lib/sem-sinal-regra";
import { SeletorClienteSemSinal, campo, rotulo, type ClienteEscolhido } from "@/components/sem-sinal/SeletorClienteSemSinal";

function Moldura({ titulo, icone, onFechar, children }: { titulo: string; icone: React.ReactNode; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-lg bg-slate-900 p-1.5 text-agro-400">{icone}</span>
        <h2 className="flex-1 text-base font-bold text-slate-900">{titulo}</h2>
        <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  );
}

function Rodape({ salvando, erro, onFechar, texto }: { salvando: boolean; erro: string | null; onFechar: () => void; texto: string }) {
  return (
    <>
      {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erro}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={salvando} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {salvando && <Loader2 size={16} className="animate-spin" />} {texto}
        </button>
        <button type="button" onClick={onFechar} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
          Cancelar
        </button>
      </div>
    </>
  );
}

export function FormVisitaSemSinal({
  clientes, municipios, hoje, clienteInicial, onSalvar, onFechar,
}: {
  clientes: ClienteVista[];
  municipios: string[];
  hoje: string;
  clienteInicial?: ClienteEscolhido | null;
  onSalvar: (op: OpAgendarVisita) => Promise<void>;
  onFechar: () => void;
}) {
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(clienteInicial ?? null);
  const [dia, setDia] = useState(hoje);
  const [horario, setHorario] = useState("");
  const [cidade, setCidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) { setErro("Escolha o cliente (ou cadastre um novo)."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) { setErro("Escolha o dia da visita."); return; }
    setErro(null);
    setSalvando(true);
    try {
      await onSalvar({
        tipo: "visita.agendar", id: novoId(), criadaEm: new Date().toISOString(), clienteNome: cliente.nome,
        visitaId: novoId(), clienteId: cliente.id, ...(cliente.novo ? { novoCliente: cliente.novo } : {}),
        data: dia, horario: /^\d{2}:\d{2}$/.test(horario) ? horario : null,
        cidade: cidade.trim() || null, observacao: observacao.trim() || null,
      });
    } catch (err) {
      setErro(`Não guardou no aparelho: ${err instanceof Error ? err.message : String(err)}`);
      setSalvando(false);
    }
  };

  return (
    <Moldura titulo="Agendar visita" icone={<CalendarPlus size={16} />} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <SeletorClienteSemSinal clientes={clientes} valor={cliente} onChange={setCliente} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={rotulo} htmlFor="ss-dia">Dia</label>
            <input id="ss-dia" type="date" className={campo} value={dia} min={hoje} onChange={(e) => setDia(e.target.value)} />
          </div>
          <div>
            <label className={rotulo} htmlFor="ss-hora">Horário (opcional)</label>
            <input id="ss-hora" type="time" className={campo} value={horario} onChange={(e) => setHorario(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={rotulo} htmlFor="ss-cidade">Cidade (opcional)</label>
          <input id="ss-cidade" className={campo} list="ss-municipios" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder={cliente?.municipio ?? "A do cadastro do cliente"} autoComplete="off" />
          <datalist id="ss-municipios">{municipios.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
        <div>
          <label className={rotulo} htmlFor="ss-obs">Observação (opcional)</label>
          <textarea id="ss-obs" className={campo} rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: levar catálogo da B95B" />
        </div>
        <Rodape salvando={salvando} erro={erro} onFechar={onFechar} texto="Guardar visita" />
      </form>
    </Moldura>
  );
}

export function FormNegociacaoSemSinal({
  clientes, colunas, maquinas, clienteInicial, onSalvar, onFechar,
}: {
  clientes: ClienteVista[];
  colunas: ColunaPacote[];
  maquinas: MaquinaPacote[];
  clienteInicial?: ClienteEscolhido | null;
  onSalvar: (op: OpCriarNegociacao) => Promise<void>;
  onFechar: () => void;
}) {
  const abertas = useMemo(() => colunasParaNovaNegociacao(colunas), [colunas]);
  const marcas = useMemo(() => [...new Set(maquinas.map((m) => m.marca))], [maquinas]);
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(clienteInicial ?? null);
  // Começa sem marca, como o formulário do CRM com internet (FormNovaNegociacao):
  // adivinhar pela ordem do catálogo pôs "Dynapac" numa B95B no teste. O
  // modelo digitado do catálogo escolhe a marca sozinho (escolherModelo).
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [valorTxt, setValorTxt] = useState("");
  const [estagio, setEstagio] = useState((abertas.find((c) => c.papel === "em_negociacao") ?? abertas[0])?.titulo ?? "");
  const [proximaAcao, setProximaAcao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const modelos = useMemo(() => maquinas.filter((m) => !marca || m.marca === marca).map((m) => m.modelo), [maquinas, marca]);
  // Modelo do catálogo digitado: a marca acompanha (B95B é New Holland, CA25 é Dynapac).
  const escolherModelo = (txt: string) => {
    const doCatalogo = maquinas.find((m) => m.modelo.toLowerCase() === txt.trim().toLowerCase());
    // Do catálogo, grava com o nome de lá ("l320" vira "L320"), como o
    // seletor do formulário com internet.
    setModelo(doCatalogo ? doCatalogo.modelo : txt);
    if (doCatalogo && doCatalogo.marca !== marca) setMarca(doCatalogo.marca);
  };
  const valor = lerValorBR(valorTxt);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) { setErro("Escolha o cliente (ou cadastre um novo)."); return; }
    if (!estagio) { setErro("O funil guardado não tem coluna aberta. Abra o CRM com internet uma vez para baixar o funil."); return; }
    if (valor === "invalido") { setErro("Não entendi o valor. Escreva só números, ex.: 450.000"); return; }
    setErro(null);
    setSalvando(true);
    try {
      await onSalvar({
        tipo: "negociacao.criar", id: novoId(), criadaEm: new Date().toISOString(), clienteNome: cliente.nome,
        negociacaoId: novoId(), clienteId: cliente.id, ...(cliente.novo ? { novoCliente: cliente.novo } : {}),
        marca: marca.trim() || null, maquinaModelo: modelo.trim() || null, valor, estagio,
        proximaAcao: proximaAcao.trim() || null,
      });
    } catch (err) {
      setErro(`Não guardou no aparelho: ${err instanceof Error ? err.message : String(err)}`);
      setSalvando(false);
    }
  };

  return (
    <Moldura titulo="Nova negociação no funil" icone={<Handshake size={16} />} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <SeletorClienteSemSinal clientes={clientes} valor={cliente} onChange={setCliente} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={rotulo} htmlFor="ss-marca">Marca</label>
            {marcas.length ? (
              <select id="ss-marca" className={campo} value={marca} onChange={(e) => { setMarca(e.target.value); setModelo(""); }}>
                <option value="">— Selecionar —</option>
                {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value="Outro">Outro</option>
              </select>
            ) : (
              <input id="ss-marca" className={campo} value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="New Holland" />
            )}
          </div>
          <div>
            <label className={rotulo} htmlFor="ss-modelo">Modelo</label>
            <input id="ss-modelo" className={campo} list="ss-modelos" value={modelo} onChange={(e) => escolherModelo(e.target.value)} placeholder="Ex.: B95B" autoComplete="off" />
            <datalist id="ss-modelos">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={rotulo} htmlFor="ss-valor">Valor (opcional)</label>
            <input id="ss-valor" className={campo} inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} placeholder="Ex.: 450.000" autoComplete="off" />
            <p className={`mt-1 text-[11px] ${valor === "invalido" ? "font-semibold text-red-600" : "text-slate-500"}`}>
              {valor === "invalido" ? "Valor não entendido" : valor != null ? formatarReais(valor) : " "}
            </p>
          </div>
          <div>
            <label className={rotulo} htmlFor="ss-coluna">Coluna do funil</label>
            <select id="ss-coluna" className={campo} value={estagio} onChange={(e) => setEstagio(e.target.value)}>
              {abertas.map((c) => <option key={c.titulo} value={c.titulo}>{c.titulo}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={rotulo} htmlFor="ss-proxima">Próxima ação (opcional)</label>
          <input id="ss-proxima" className={campo} value={proximaAcao} onChange={(e) => setProximaAcao(e.target.value)} placeholder="Ex.: mandar proposta na segunda" autoComplete="off" />
        </div>
        <Rodape salvando={salvando} erro={erro} onFechar={onFechar} texto="Guardar negociação" />
      </form>
    </Moldura>
  );
}
