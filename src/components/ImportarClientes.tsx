"use client";

import { useState } from "react";
import { importarClientesCsv } from "@/lib/actions";
import { Upload, X } from "lucide-react";

export function ImportarClientes() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
      >
        <Upload size={16} /> Importar
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            action={async (fd) => {
              await importarClientesCsv(fd);
              setAberto(false);
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
              Cole sua lista no formato <code className="rounded bg-slate-100 px-1">nome,telefone,município</code>
              {" "}(uma por linha). Duplicados são ignorados automaticamente.
            </p>
            <textarea
              name="csv"
              rows={8}
              placeholder={"João Batista,28999990000,Cachoeiro de Itapemirim\nMaria Souza,28988887777,Alegre"}
              className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            <button className="mt-4 w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700">
              Importar lista
            </button>
          </form>
        </div>
      )}
    </>
  );
}
