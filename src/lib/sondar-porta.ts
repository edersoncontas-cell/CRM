// Uma tentativa de abrir conexão TCP, sem mandar nada: diz se a máquina do
// outro lado está ligada. Usada só no diagnóstico (clique dele ou a tela
// caída), nunca em laço. Regras de leitura: lib/evolution-servidor-regra.ts.

import net from "node:net";
import type { PortaSsh } from "@/lib/evolution-servidor-regra";

export function sondarPorta(host: string, porta: number, ms = 5_000): Promise<Exclude<PortaSsh, "nao-testada">> {
  return new Promise((resolve) => {
    let feito = false;
    const s = net.connect({ host, port: porta });
    const fim = (r: Exclude<PortaSsh, "nao-testada">) => {
      if (feito) return;
      feito = true;
      clearTimeout(relogio);
      s.destroy();
      resolve(r);
    };
    const relogio = setTimeout(() => fim("silencio"), ms);
    s.once("connect", () => fim("responde"));
    // Recusar é a máquina dizendo "não tem ninguém nesta porta": está ligada.
    s.once("error", (e: NodeJS.ErrnoException) => fim(e.code === "ECONNREFUSED" ? "recusa" : "silencio"));
  });
}
