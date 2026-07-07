"use client";

import { useState } from "react";
import { importarClientesCsv, importarClientesExcel } from "@/lib/actions";
import { Upload, X, CheckCircle, AlertCircle, FileSpreadsheet, ClipboardPaste } from "lucide-react";

type Resultado = { importados: number; ignorados: number; erros: number; erro?: string };

export function ImportarClientes() {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<"texto" | "excel">("texto");
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function abrir() {
    setAberto(true);
    setResultado(null);
  }

  async function enviar(fd: FormData) {
    setCarregando(true);
    setResultado(null);
    try {
      const r = modo === "texto" ? await importarClientesCsv(fd) : await importarClientesExcel(fd);
      setResultado(r);
      if (r.importados > 0) {
        setTimeout(() => setAberto(false), 2000);
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <button
        onClick={abrir}
        className="flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
      >
        <Upload size={16} /> Importar
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form action={enviar} className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Importar clientes</h2>
              <button type="button" onClick={() => setAberto(false)}>
                <X className="text-slate-400" />
              </button>
            </div>

            <div className="mb-4 flex rounded-lg border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => { setModo("texto"); setResultado(null); }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${modo === "texto" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              >
                <ClipboardPaste size={13} /> Colar texto
              </button>
              <button
                type="button"
                onClick={() => { setModo("excel"); setResultado(null); }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${modo === "excel" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              >
                <FileSpreadsheet size={13} /> Arquivo Excel (Google Contacts)
              </button>
            </div>

            {modo === "texto" ? (
              <>
                <p className="mb-2 text-sm text-slate-500">
                  Cole sua lista no formato{" "}
                  <code className="rounded bg-slate-100 px-1">nome,telefone,município</code>{" "}
                  (uma por linha). Duplicados são ignorados. O município é opcional.
                </p>
                <textarea
                  name="csv"
                  rows={8}
                  placeholder={
                    "Lucas Serafim,28999798168,Cachoeiro\nMaria Souza,28988887777,Alegre\nJoão,5528999990000,"
                  }
                  className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />
              </>
            ) : (
              <>
                <p className="mb-2 text-sm text-slate-500">
                  No Google Contacts, exporte em <b>Exportar → Google CSV</b>, abra o arquivo no Excel/Google
                  Sheets e salve como <b>.xlsx</b>. Contatos que já existem no CRM (mesmo telefone ou nome) são
                  ignorados automaticamente — só os novos são cadastrados.
                </p>
                <input
                  type="file"
                  name="arquivo"
                  accept=".xlsx"
                  required
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />
              </>
            )}

            {resultado && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                  resultado.erro
                    ? "bg-red-50 text-red-700"
                    : resultado.importados > 0
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                {resultado.erro ? (
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                ) : resultado.importados > 0 ? (
                  <CheckCircle size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                )}
                <span>
                  {resultado.erro
                    ? resultado.erro
                    : resultado.importados > 0
                    ? `${resultado.importados} cliente${resultado.importados !== 1 ? "s" : ""} importado${resultado.importados !== 1 ? "s" : ""} com sucesso!`
                    : "Nenhum cliente novo importado."}
                  {!resultado.erro && resultado.ignorados > 0 &&
                    ` ${resultado.ignorados} já existiam (ignorados).`}
                  {!resultado.erro && resultado.erros > 0 &&
                    ` ${resultado.erros} linha${resultado.erros !== 1 ? "s" : ""} com erro.`}
                </span>
              </div>
            )}

            <button
              disabled={carregando}
              className="mt-4 w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {carregando ? "Importando…" : "Importar"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
