import Link from "next/link";
import { Card } from "@/components/ui";
import { TRILHA } from "@/lib/academia-trilha";
import { ETAPAS_POR_ID } from "@/lib/academia/etapas";
import { GraduationCap, Footprints, ArrowRight } from "lucide-react";

// O PLANO DE ESTUDO SOB MEDIDA.
//
// Este bloco é a ponte entre o diagnóstico e a Academia: os módulos e as
// etapas aqui não foram escolhidos por currículo, foram escolhidos pelos
// números DELE. É por isso que cada item vem com o "por causa de quê" — uma
// lista de aulas sem motivo é só índice, e índice ninguém abre.
//
// Aparece nas duas telas: em "Como você vende" (fim do diagnóstico) e na
// Academia (primeira aba), para quem entra pela Academia não precisar saber
// que o diagnóstico existe.
export function PlanoDeEstudo({
  modulos,
  etapas,
  compacto,
}: {
  modulos: string[];
  etapas: string[];
  compacto?: boolean;
}) {
  const mods = modulos.map((id) => TRILHA.find((m) => m.id === id)).filter(Boolean);
  const eps = etapas.map((id) => ETAPAS_POR_ID.get(id)).filter(Boolean);

  if (!mods.length && !eps.length) {
    return (
      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Seu plano de estudo</h2>
        <p className="mt-2 text-sm text-slate-500">
          Os números não apontam um vazamento claro agora — não há aula &ldquo;de urgência&rdquo; a indicar.
          Siga a Trilha de Formação na ordem dela.
        </p>
        <Link href="/academia" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800">
          <GraduationCap size={15} /> Abrir a Academia
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Seu plano de estudo</h2>
      <p className="mb-4 mt-1 text-xs text-slate-500">
        {compacto
          ? "Escolhido pelos seus números, não pelo currículo. Comece de cima: é o que mais te custa venda hoje."
          : "Estas aulas não foram escolhidas por currículo — foram escolhidas pelo que os seus números mostraram acima. Comece de cima."}
      </p>

      {mods.length > 0 && (
        <>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
            <GraduationCap size={14} /> Módulos da Trilha
          </div>
          <ul className="mb-4 space-y-2">
            {mods.map((m, i) => (
              <li key={m!.id}>
                <Link
                  href="/academia"
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50"
                  style={{ borderLeft: `3px solid ${m!.cor}` }}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: m!.cor }}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-800">{m!.titulo}</span>
                    <span className="block text-[11px] text-slate-500">
                      Nível {m!.nivel} · {m!.tema} · {m!.aulas.length} aula(s)
                    </span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {eps.length > 0 && (
        <>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
            <Footprints size={14} /> Etapas da Venda para reler
          </div>
          <ul className="space-y-2">
            {eps.map((e) => (
              <li key={e!.id}>
                <Link href="/academia" className="block rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
                  <span className="block text-sm font-bold text-slate-800">{e!.nome}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{e!.objetivo}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
