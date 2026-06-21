"use client";

import { useState } from "react";
import { importarClientesCsv } from "@/lib/actions";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";

type Resultado = { importados: number; ignorados: number; erros: number };

export function ImportarClientes() {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function abrir() {
    setAberto(true);
    setResultado(null);
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
          <form
            action={async (fd) => {
              setCarregando(true);
              try {
                const r = await importarClientesCsv(fd);
                setResultado(r);
                if (r.importados > 0) {
                  // Fecha após 2 s quando há sucesso
                  setTimeout(() => setAberto(false), 2000);
                }
              } finally {
                setCarregando(false);
              }
            }}
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Importar clientes</h2>
              <button type="button" onClick={() => setAberto(false)}>
                <X className="text-slate-400" />
              </button>
            </div>
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

            {resultado && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                  resultado.importados > 0
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                {resultado.importados > 0 ? (
                  <CheckCircle size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                )}
                <span>
                  {resultado.importados > 0
                    ? `${resultado.importados} cliente${resultado.importados !== 1 ? "s" : ""} importado${resultado.importados !== 1 ? "s" : ""} com sucesso!`
                    : "Nenhum cliente novo importado."}
                  {resultado.ignorados > 0 &&
                    ` ${resultado.ignorados} já existiam (ignorados).`}
                  {resultado.erros > 0 &&
                    ` ${resultado.erros} linha${resultado.erros !== 1 ? "s" : ""} com erro.`}
                </span>
              </div>
            )}

            <button
              disabled={carregando}
              className="mt-4 w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {carregando ? "Importando…" : "Importar lista"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
