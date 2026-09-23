// Painel "Notícias do setor" do Dashboard (café, crédito, obras, máquinas,
// marcas, agro) — mesmas fontes do letreiro, mostradas em lista.

import { obterNoticias } from "@/lib/noticias";
import { Painel } from "@/components/dashboard-ui";
import type { TemaDash } from "@/lib/dash-tema";
import { temaDashAtual } from "@/lib/tema-servidor";
import { Newspaper, ExternalLink } from "lucide-react";

const corTema = (T: TemaDash): Record<string, string> =>
  ({ Café: T.amarelo, Crédito: T.verde, Obras: T.laranja, Máquinas: T.ciano, Marcas: T.violeta, Agro: T.verde });

function quando(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "agora há pouco";
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

export async function NoticiasSetor() {
  const T = temaDashAtual();
  const { itens, atualizadoEm } = await obterNoticias();
  return (
    <Painel
      titulo="Notícias do setor"
      subtitulo={`café · crédito · obras · máquinas · agro${atualizadoEm ? ` · atualizado ${quando(atualizadoEm)}` : ""}`}
    >
      {itens.length === 0 ? (
        <p className="flex items-center gap-2 text-xs" style={{ color: T.mudo }}><Newspaper size={14} /> Sem notícias disponíveis no momento — tentando de novo em alguns minutos.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {itens.slice(0, 10).map((n, i) => (
            <li key={i}>
              <a href={n.link} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm transition hover:brightness-125" style={{ background: T.sobre }}>
                <span className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ background: `${corTema(T)[n.tema] ?? T.violeta}22`, color: corTema(T)[n.tema] ?? T.violeta }}>{n.tema}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-semibold" style={{ color: T.texto }}>{n.titulo}</span>
                  <span className="text-[11px]" style={{ color: T.mudo }}>{n.fonte ?? "Google Notícias"}{n.publicadoEm ? ` · ${quando(n.publicadoEm)}` : ""}</span>
                </span>
                <ExternalLink size={13} className="mt-1 shrink-0" style={{ color: T.mudo }} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );
}
