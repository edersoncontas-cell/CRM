// Constantes das ações em lote da lista de Clientes.
//
// Vivem FORA do arquivo "use server": um módulo de server actions só pode
// exportar funções assíncronas, e o build recusa qualquer constante ou tipo
// exportado junto. Separar também deixa a tela importar estes rótulos sem
// arrastar o banco para o navegador.

import { STATUS_NAO_CLIENTE } from "@/lib/cliente-status";

export const STATUS_VALIDOS = ["cliente", "potencial", STATUS_NAO_CLIENTE] as const;
export type StatusCliente = (typeof STATUS_VALIDOS)[number];

export const ROTULO_STATUS: Record<StatusCliente, string> = {
  cliente: "✓ cliente",
  potencial: "potencial",
  [STATUS_NAO_CLIENTE]: "não é cliente",
};

/** Teto por ação: evita um clique sem querer derrubar a base inteira. */
export const MAX_POR_LOTE = 500;
